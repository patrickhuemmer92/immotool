"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEdit, getActiveWorkspace } from "@/lib/workspace";
import { parseDecimal } from "@/lib/format";
import { OWNER_TAX_FIELD_PREFIX } from "./owner-tax-fields";

const requiredPercentSetting = z
  .string()
  .min(1, "required")
  .superRefine((v, ctx) => {
    const n = parseDecimal(v);
    if (n === null || n < 0 || n > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_percent:${v}`,
      });
    }
  })
  .transform((v) => (parseDecimal(v) as number) / 100);

/** Optional non-negative number (e.g. €/m², €/Monat). */
const optionalNonNegNumber = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || v.trim().length === 0) return;
    const n = parseDecimal(v);
    if (n === null || n < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v}`,
      });
    }
  })
  .transform((v) => {
    if (!v || v.trim().length === 0) return 0;
    return parseDecimal(v) as number;
  });

// Mieterscoring-Gewichtungen sind aus dem UI entfernt — Schema enthält sie
// nicht mehr. Wenn alte Einträge in der DB liegen, werden sie ignoriert.
const settingsSchema = z.object({
  tax_rate: requiredPercentSetting,
  default_depreciation_rate: requiredPercentSetting,
  default_locale: z.enum(["de", "en"]),
  default_currency: z.string().min(3).max(3),
  cashflow_convention: z.enum(["net", "gross"]).optional().default("net"),
  default_vacancy_residential: requiredPercentSetting,
  default_vacancy_commercial: requiredPercentSetting,
  default_management_per_unit: optionalNonNegNumber,
  bank_maintenance_per_sqm: optionalNonNegNumber,
});

export type FormState = { error?: string; success?: boolean } | undefined;

export async function updateSettings(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = settingsSchema.safeParse({
    tax_rate: formData.get("tax_rate"),
    default_depreciation_rate: formData.get("default_depreciation_rate"),
    default_locale: formData.get("default_locale"),
    default_currency: formData.get("default_currency"),
    cashflow_convention: formData.get("cashflow_convention") || undefined,
    default_vacancy_residential: formData.get("default_vacancy_residential"),
    default_vacancy_commercial: formData.get("default_vacancy_commercial"),
    default_management_per_unit:
      formData.get("default_management_per_unit") || undefined,
    bank_maintenance_per_sqm:
      formData.get("bank_maintenance_per_sqm") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      tax_rate: parsed.data.tax_rate,
      default_depreciation_rate: parsed.data.default_depreciation_rate,
      default_locale: parsed.data.default_locale,
      default_currency: parsed.data.default_currency,
      cashflow_convention: parsed.data.cashflow_convention,
      default_vacancy_residential: parsed.data.default_vacancy_residential,
      default_vacancy_commercial: parsed.data.default_vacancy_commercial,
      default_management_per_unit: parsed.data.default_management_per_unit,
      bank_maintenance_per_sqm: parsed.data.bank_maintenance_per_sqm,
    })
    .eq("workspace_id", active.id);

  if (error) return { error: error.message };

  revalidatePath("/einstellungen");
  return { success: true };
}

/** Roh-UUID-Check für die Owner-IDs aus den Feldnamen. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persönliche Steuersätze der Eigentümer (Migration 0027).
 *
 * Felder heißen `owner_tax_rate:<owner-id>`; ein leeres Feld bedeutet
 * „kein eigener Satz" → NULL → Fallback auf settings.tax_rate. Der Wert
 * kommt als Prozent aus dem UI und wird als Dezimalwert gespeichert.
 */
export async function updateOwnerTaxRates(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };
  if (!canEdit(active.role)) return { error: "forbidden" };

  const updates: { id: string; tax_rate: number | null }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(OWNER_TAX_FIELD_PREFIX)) continue;
    const id = key.slice(OWNER_TAX_FIELD_PREFIX.length);
    if (!UUID_RE.test(id)) continue;

    const raw = String(value ?? "").trim();
    if (raw.length === 0) {
      updates.push({ id, tax_rate: null });
      continue;
    }
    const percent = parseDecimal(raw);
    if (percent === null || percent < 0 || percent > 100) {
      return { error: `invalid_percent:${raw}` };
    }
    updates.push({ id, tax_rate: percent / 100 });
  }

  if (updates.length === 0) return { success: true };

  const supabase = await createClient();
  // Einzel-Updates statt Upsert: `owners` hat NOT-NULL-Spalten (name,
  // workspace_id), die wir hier nicht anfassen wollen. Der zusätzliche
  // workspace_id-Filter verhindert Updates auf fremde Eigentümer, auch
  // wenn eine manipulierte Formular-ID durchkommt.
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("owners")
        .update({ tax_rate: u.tax_rate } as never)
        .eq("id", u.id)
        .eq("workspace_id", active.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  // Der Satz wirkt in GuV, Cashflow, Dashboard, Factbook und Simulationen —
  // deshalb das ganze Layout invalidieren, nicht nur /einstellungen.
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateWorkspaceName(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name darf nicht leer sein." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name })
    .eq("id", active.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
