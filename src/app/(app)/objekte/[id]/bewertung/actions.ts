"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ValuationState = { error?: string } | undefined;

const optNum = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) throw new Error(`invalid_number:${v}`);
    return n;
  });

const optInt = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = parseInt(v, 10);
    if (!Number.isInteger(n)) throw new Error("invalid_int");
    return n;
  });

const schema = z.object({
  valuation_date: z.string().min(1),
  condition_score: optInt,
  market_rent_per_sqm: optNum,
  multiple: optNum,
  building_value: optNum,
  notes: z.string().optional().transform((v) => (v && v.length ? v : null)),
});

function parse(formData: FormData) {
  return {
    valuation_date: formData.get("valuation_date") ?? undefined,
    condition_score: formData.get("condition_score") ?? undefined,
    market_rent_per_sqm: formData.get("market_rent_per_sqm") ?? undefined,
    multiple: formData.get("multiple") ?? undefined,
    building_value: formData.get("building_value") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  };
}

export async function createValuation(
  propertyId: string,
  _prev: ValuationState,
  formData: FormData
): Promise<ValuationState> {
  let parsed;
  try {
    parsed = schema.safeParse(parse(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_valuations")
    .insert({ ...parsed.data, property_id: propertyId });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/bewertung`);
  revalidatePath(`/portfolio`);
  return undefined;
}

export async function deleteValuation(id: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("portfolio_valuations").delete().eq("id", id);
  revalidatePath(`/objekte/${propertyId}/bewertung`);
  revalidatePath(`/portfolio`);
}
