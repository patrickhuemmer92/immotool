"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { parseDecimal } from "@/lib/format";
import { TENANT_SCORE_FIELDS } from "@/lib/calculations/tenant";

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

const requiredNonNegWeight = z
  .string()
  .min(1, "required")
  .superRefine((v, ctx) => {
    const n = parseDecimal(v);
    if (n === null || n < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v}`,
      });
    }
  })
  .transform((v) => parseDecimal(v) as number);

const settingsSchema = z.object({
  tax_rate: requiredPercentSetting,
  default_depreciation_rate: requiredPercentSetting,
  default_locale: z.enum(["de", "en"]),
  default_currency: z.string().min(3).max(3),
  weight_family_status: requiredNonNegWeight,
  weight_schufa: requiredNonNegWeight,
  weight_rental_duration: requiredNonNegWeight,
  weight_personal_impression: requiredNonNegWeight,
  weight_employment_status: requiredNonNegWeight,
  weight_income_level: requiredNonNegWeight,
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
    weight_family_status: formData.get("weight_family_status"),
    weight_schufa: formData.get("weight_schufa"),
    weight_rental_duration: formData.get("weight_rental_duration"),
    weight_personal_impression: formData.get("weight_personal_impression"),
    weight_employment_status: formData.get("weight_employment_status"),
    weight_income_level: formData.get("weight_income_level"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Reject "all weights zero" — that'd make the score un-computable.
  const sum = TENANT_SCORE_FIELDS.reduce(
    (acc, f) => acc + (parsed.data[`weight_${f}` as keyof typeof parsed.data] as number),
    0
  );
  if (sum <= 0) return { error: "weights_all_zero" };

  const tenant_score_weights: Record<string, number> = {};
  for (const f of TENANT_SCORE_FIELDS) {
    tenant_score_weights[f] = parsed.data[
      `weight_${f}` as keyof typeof parsed.data
    ] as number;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      tax_rate: parsed.data.tax_rate,
      default_depreciation_rate: parsed.data.default_depreciation_rate,
      default_locale: parsed.data.default_locale,
      default_currency: parsed.data.default_currency,
      tenant_score_weights,
    })
    .eq("workspace_id", active.id);

  if (error) return { error: error.message };

  revalidatePath("/einstellungen");
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
