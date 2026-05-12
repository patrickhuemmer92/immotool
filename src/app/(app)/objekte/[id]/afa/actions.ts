"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type AfaItemState = { error?: string } | undefined;

const requiredAmount = z
  .string()
  .min(1, "required")
  .superRefine((v, ctx) => {
    if (parseDecimal(v) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v}`,
      });
    }
  })
  .transform((v) => parseDecimal(v) as number);

const requiredInt = z
  .string()
  .min(1, "required")
  .superRefine((v, ctx) => {
    const n = parseInt(v, 10);
    if (!Number.isInteger(n) || n <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid_int",
      });
    }
  })
  .transform((v) => parseInt(v, 10));

const schema = z.object({
  item_name: z.string().min(1, "name_required"),
  acquisition_cost: requiredAmount,
  acquisition_date: z.string().min(1, "date_required"),
  duration_years: requiredInt,
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

export async function addOtherDepreciationItem(
  propertyId: string,
  _prev: AfaItemState,
  formData: FormData
): Promise<AfaItemState> {
  const parsed = schema.safeParse({
    item_name: getStr(formData, "item_name"),
    acquisition_cost: getStr(formData, "acquisition_cost"),
    acquisition_date: getStr(formData, "acquisition_date"),
    duration_years: getStr(formData, "duration_years"),
    notes: getStr(formData, "notes"),
  });
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
