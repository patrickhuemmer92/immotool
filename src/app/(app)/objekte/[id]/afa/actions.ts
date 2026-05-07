"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AfaItemState = { error?: string } | undefined;

const num = z.string().transform((v) => {
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("invalid_number");
  return n;
});

const intSchema = z.string().transform((v) => {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n <= 0) throw new Error("invalid_int");
  return n;
});

const schema = z.object({
  item_name: z.string().min(1, "name_required"),
  acquisition_cost: num,
  acquisition_date: z.string().min(1, "date_required"),
  duration_years: intSchema,
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

export async function addOtherDepreciationItem(
  propertyId: string,
  _prev: AfaItemState,
  formData: FormData
): Promise<AfaItemState> {
  const get = (k: string): string | undefined => {
    const v = formData.get(k);
    return v === null ? undefined : (v as string);
  };
  let parsed;
  try {
    parsed = schema.safeParse({
      item_name: get("item_name"),
      acquisition_cost: get("acquisition_cost"),
      acquisition_date: get("acquisition_date"),
      duration_years: get("duration_years"),
      notes: get("notes"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("other_depreciation_items")
    .insert({ ...parsed.data, property_id: propertyId });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/afa`);
  revalidatePath(`/finanzen/afa`);
  return undefined;
}

export async function deleteOtherDepreciationItem(
  id: string,
  propertyId: string
) {
  const supabase = await createClient();
  await supabase.from("other_depreciation_items").delete().eq("id", id);
  revalidatePath(`/objekte/${propertyId}/afa`);
  revalidatePath(`/finanzen/afa`);
}
