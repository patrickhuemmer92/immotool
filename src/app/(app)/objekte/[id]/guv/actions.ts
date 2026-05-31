"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type SnapshotState = { error?: string } | undefined;

const optNum = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    if (parseDecimal(v) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v}`,
      });
    }
  })
  .transform((v) => (v && v.length ? parseDecimal(v) : null));

// cold_rent ist NICHT mehr Teil des Form-Schemas — der Wert wird beim
// Speichern live aus der tenants-Tabelle gezogen. Damit ist der Mieter
// die Single Source of Truth für die Kaltmiete und kann nicht aus
// Versehen pro Snapshot abweichen.
const schema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  ancillary_costs: optNum,
  annuity_override: optNum,
  principal_override: optNum,
  interest_override: optNum,
  property_fee_recoverable: optNum,
  property_fee_not_recoverable: optNum,
  maintenance: optNum,
  management_costs: optNum,
  vacancy_risk_amount: optNum,
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

/**
 * Holt die Summe der Kaltmieten (€/Monat) aller AKTIVEN Mietverträge
 * für ein Objekt. „Aktiv“ heißt: unbefristet oder befristet mit
 * contract_end >= heute. Pro Objekt sind seit Migration 0018 mehrere
 * Verträge möglich (WGs, parallele Verhältnisse).
 *
 * `null` zurückgeben, wenn gar kein Mieter angelegt ist; eine echte 0
 * (z. B. nur ausgelaufene Verträge) wird ebenfalls als 0 gespeichert.
 */
async function getTenantColdRent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("tenants")
    .select("cold_rent_per_month, is_fixed_term, contract_end")
    .eq("property_id", propertyId);
  if (!data || data.length === 0) return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  return data.reduce((acc, t) => {
    const active =
      !t.is_fixed_term || !t.contract_end || t.contract_end >= todayIso;
    if (!active) return acc;
    const n = Number(t.cold_rent_per_month ?? 0);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

export async function createSnapshot(
  propertyId: string,
  _prev: SnapshotState,
  formData: FormData
): Promise<SnapshotState> {
  const parsed = schema.safeParse({
    period_start: getStr(formData, "period_start"),
    period_end: getStr(formData, "period_end"),
    ancillary_costs: getStr(formData, "ancillary_costs"),
    annuity_override: getStr(formData, "annuity_override"),
    principal_override: getStr(formData, "principal_override"),
    interest_override: getStr(formData, "interest_override"),
    property_fee_recoverable: getStr(formData, "property_fee_recoverable"),
    property_fee_not_recoverable: getStr(formData, "property_fee_not_recoverable"),
    maintenance: getStr(formData, "maintenance"),
    management_costs: getStr(formData, "management_costs"),
    vacancy_risk_amount: getStr(formData, "vacancy_risk_amount"),
    notes: getStr(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Sanity check: when user filled the total and the split, they must agree.
  const total = parsed.data.ancillary_costs;
  const rec = parsed.data.property_fee_recoverable;
  const notRec = parsed.data.property_fee_not_recoverable;
  if (total != null && rec != null && notRec != null) {
    if (Math.abs(rec + notRec - total) > 0.01) {
      return { error: "hausgeld_sum_invalid" };
    }
  }

  const supabase = await createClient();
  const coldRent = await getTenantColdRent(supabase, propertyId);
  const { error } = await supabase
    .from("pnl_snapshots")
    .insert({ ...parsed.data, cold_rent: coldRent, property_id: propertyId });

  if (error) {
    // Unique constraint pnl_snapshots_property_id_period_start_period_end_key.
    if (error.code === "23505" || error.message.includes("duplicate")) {
      return { error: "duplicate_period" };
    }
    return { error: error.message };
  }

  revalidatePath(`/objekte/${propertyId}/guv`);
  revalidatePath(`/finanzen/guv`);
  redirect(`/objekte/${propertyId}/guv`);
}

export async function updateSnapshot(
  snapshotId: string,
  propertyId: string,
  _prev: SnapshotState,
  formData: FormData
): Promise<SnapshotState> {
  const parsed = schema.safeParse({
    period_start: getStr(formData, "period_start"),
    period_end: getStr(formData, "period_end"),
    ancillary_costs: getStr(formData, "ancillary_costs"),
    annuity_override: getStr(formData, "annuity_override"),
    principal_override: getStr(formData, "principal_override"),
    interest_override: getStr(formData, "interest_override"),
    property_fee_recoverable: getStr(formData, "property_fee_recoverable"),
    property_fee_not_recoverable: getStr(formData, "property_fee_not_recoverable"),
    maintenance: getStr(formData, "maintenance"),
    management_costs: getStr(formData, "management_costs"),
    vacancy_risk_amount: getStr(formData, "vacancy_risk_amount"),
    notes: getStr(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const total = parsed.data.ancillary_costs;
  const rec = parsed.data.property_fee_recoverable;
  const notRec = parsed.data.property_fee_not_recoverable;
  if (total != null && rec != null && notRec != null) {
    if (Math.abs(rec + notRec - total) > 0.01) {
      return { error: "hausgeld_sum_invalid" };
    }
  }

  const supabase = await createClient();
  const coldRent = await getTenantColdRent(supabase, propertyId);
  const { error } = await supabase
    .from("pnl_snapshots")
    .update({ ...parsed.data, cold_rent: coldRent })
    .eq("id", snapshotId);

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      return { error: "duplicate_period" };
    }
    return { error: error.message };
  }

  revalidatePath(`/objekte/${propertyId}/guv`);
  revalidatePath(`/finanzen/guv`);
  return undefined;
}

export async function deleteSnapshot(snapshotId: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("pnl_snapshots").delete().eq("id", snapshotId);
  revalidatePath(`/objekte/${propertyId}/guv`);
  revalidatePath(`/finanzen/guv`);
}
