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

const schema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  cold_rent: optNum,
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
    cold_rent: getStr(formData, "cold_rent"),
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
  const { error } = await supabase
    .from("pnl_snapshots")
    .insert({ ...parsed.data, property_id: propertyId });

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
    cold_rent: getStr(formData, "cold_rent"),
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
  const { error } = await supabase
    .from("pnl_snapshots")
    .update(parsed.data)
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
