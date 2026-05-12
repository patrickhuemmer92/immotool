"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type InvestmentState = { error?: string } | undefined;

const MEASURE_TYPES = [
  "fixed_individual",
  "optional_individual",
  "fixed_common_reserve",
  "fixed_common_levy",
  "optional_common_reserve",
  "optional_common_levy",
] as const;

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

const schema = z
  .object({
    year: z
      .string()
      .optional()
      .superRefine((v, ctx) => {
        if (!v || !v.length) return;
        const n = parseInt(v, 10);
        if (!Number.isInteger(n) || n < 1900 || n > 2200) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "invalid_year",
          });
        }
      })
      .transform((v) => (v && v.length ? parseInt(v, 10) : null)),
    is_long_term: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    amount: requiredAmount,
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

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

export async function createInvestment(
  propertyId: string,
  _prev: InvestmentState,
  formData: FormData
): Promise<InvestmentState> {
  const parsed = schema.safeParse({
    year: getStr(formData, "year"),
    is_long_term: getStr(formData, "is_long_term"),
    amount: getStr(formData, "amount"),
    description: getStr(formData, "description"),
    measure_type: getStr(formData, "measure_type"),
  });
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
