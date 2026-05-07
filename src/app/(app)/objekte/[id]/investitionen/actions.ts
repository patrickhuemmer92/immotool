"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type InvestmentState = { error?: string } | undefined;

const MEASURE_TYPES = [
  "fixed_individual",
  "optional_individual",
  "fixed_common_reserve",
  "fixed_common_levy",
  "optional_common_reserve",
  "optional_common_levy",
] as const;

const num = z.string().transform((v) => {
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`invalid_number:${v}`);
  return n;
});

const schema = z
  .object({
    year: z
      .string()
      .optional()
      .transform((v) => {
        if (!v || !v.length) return null;
        const n = parseInt(v, 10);
        if (!Number.isInteger(n)) throw new Error("invalid_year");
        return n;
      }),
    is_long_term: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    amount: num,
    description: z
      .string()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    measure_type: z.enum(MEASURE_TYPES),
  })
  .refine(
    (v) =>
      (v.year != null && v.is_long_term === false) ||
      (v.year == null && v.is_long_term === true),
    { message: "year_or_long_term" }
  );

export async function createInvestment(
  propertyId: string,
  _prev: InvestmentState,
  formData: FormData
): Promise<InvestmentState> {
  let parsed;
  try {
    parsed = schema.safeParse({
      year: formData.get("year"),
      is_long_term: formData.get("is_long_term"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      measure_type: formData.get("measure_type"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_plans")
    .insert({ ...parsed.data, property_id: propertyId });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/investitionen`);
  revalidatePath(`/investitionen`);
  return undefined;
}

export async function deleteInvestment(id: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("investment_plans").delete().eq("id", id);
  revalidatePath(`/objekte/${propertyId}/investitionen`);
  revalidatePath(`/investitionen`);
}
