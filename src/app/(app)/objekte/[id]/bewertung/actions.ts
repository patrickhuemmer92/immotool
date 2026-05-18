"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type ValuationState = { error?: string } | undefined;

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

const optInt = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    const n = parseInt(v, 10);
    if (!Number.isInteger(n)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v}`,
      });
    }
  })
  .transform((v) => (v && v.length ? parseInt(v, 10) : null));

const weightSchema = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    const n = parseDecimal(v);
    if (n === null || n < 0 || n > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_weight:${v}`,
      });
    }
  })
  .transform((v) => (v && v.length ? parseDecimal(v) : null));

const schema = z.object({
  valuation_date: z.string().min(1),
  condition_score: optInt,
  market_rent_per_sqm: optNum,
  multiple: optNum,
  building_value: optNum,
  land_value: optNum,
  income_weight: weightSchema,
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

export async function createValuation(
  propertyId: string,
  _prev: ValuationState,
  formData: FormData
): Promise<ValuationState> {
  const parsed = schema.safeParse({
    valuation_date: getStr(formData, "valuation_date"),
    condition_score: getStr(formData, "condition_score"),
    market_rent_per_sqm: getStr(formData, "market_rent_per_sqm"),
    multiple: getStr(formData, "multiple"),
    building_value: getStr(formData, "building_value"),
    land_value: getStr(formData, "land_value"),
    income_weight: getStr(formData, "income_weight"),
    notes: getStr(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { income_weight, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("portfolio_valuations").insert({
    ...rest,
    property_id: propertyId,
    income_weight: income_weight ?? 0.5,
  });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/bewertung`);
  revalidatePath(`/objekte`);
  return undefined;
}

export async function updateValuation(
  valuationId: string,
  propertyId: string,
  _prev: ValuationState,
  formData: FormData
): Promise<ValuationState> {
  const parsed = schema.safeParse({
    valuation_date: getStr(formData, "valuation_date"),
    condition_score: getStr(formData, "condition_score"),
    market_rent_per_sqm: getStr(formData, "market_rent_per_sqm"),
    multiple: getStr(formData, "multiple"),
    building_value: getStr(formData, "building_value"),
    land_value: getStr(formData, "land_value"),
    income_weight: getStr(formData, "income_weight"),
    notes: getStr(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { income_weight, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_valuations")
    .update({ ...rest, income_weight: income_weight ?? 0.5 })
    .eq("id", valuationId);

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/bewertung`);
  revalidatePath(`/objekte`);
  return undefined;
}

export async function deleteValuation(id: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("portfolio_valuations").delete().eq("id", id);
  revalidatePath(`/objekte/${propertyId}/bewertung`);
  revalidatePath(`/objekte`);
}
