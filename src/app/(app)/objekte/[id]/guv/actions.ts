"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SnapshotState = { error?: string } | undefined;

const optNum = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) throw new Error(`invalid_number:${v}`);
    return n;
  });

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
  notes: z.string().optional().transform((v) => (v && v.length ? v : null)),
});

function parse(formData: FormData) {
  const obj: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of [
    "period_start",
    "period_end",
    "cold_rent",
    "ancillary_costs",
    "annuity_override",
    "principal_override",
    "interest_override",
    "property_fee_recoverable",
    "property_fee_not_recoverable",
    "maintenance",
    "notes",
  ]) {
    const v = formData.get(k);
    obj[k] = v === null ? undefined : v;
  }
  return obj;
}

export async function createSnapshot(
  propertyId: string,
  _prev: SnapshotState,
  formData: FormData
): Promise<SnapshotState> {
  let parsed;
  try {
    parsed = schema.safeParse(parse(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pnl_snapshots")
    .insert({ ...parsed.data, property_id: propertyId });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/guv`);
  revalidatePath(`/finanzen/guv`);
  redirect(`/objekte/${propertyId}/guv`);
}

export async function deleteSnapshot(snapshotId: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("pnl_snapshots").delete().eq("id", snapshotId);
  revalidatePath(`/objekte/${propertyId}/guv`);
  revalidatePath(`/finanzen/guv`);
}
