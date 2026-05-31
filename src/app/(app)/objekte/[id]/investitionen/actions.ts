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

const TAX_TREATMENTS = [
  "expense_immediate",
  "expense_82b",
  "capitalized_building",
  "capitalized_separate",
  "non_deductible",
] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

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

const optInt = (minMessage: string) =>
  z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (!v || !v.length) return;
      const n = parseInt(v, 10);
      if (!Number.isInteger(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: minMessage,
        });
      }
    })
    .transform((v) => (v && v.length ? parseInt(v, 10) : null));

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
    tax_treatment: z.enum(TAX_TREATMENTS).default("expense_immediate"),
    expense_82b_years: optInt("invalid_82b_years"),
    useful_life_years: optInt("invalid_life_years"),
  })
  .refine(
    (v) =>
      (v.year != null && v.is_long_term === false) ||
      (v.year == null && v.is_long_term === true),
    { message: "year_or_long_term" }
  )
  .refine(
    (v) => {
      if (v.tax_treatment === "expense_82b") {
        return (
          v.expense_82b_years != null &&
          v.expense_82b_years >= 2 &&
          v.expense_82b_years <= 5
        );
      }
      return true;
    },
    { message: "expense_82b_years_required" }
  )
  .refine(
    (v) => {
      if (v.tax_treatment === "capitalized_separate") {
        return (
          v.useful_life_years != null &&
          v.useful_life_years >= 1 &&
          v.useful_life_years <= 100
        );
      }
      return true;
    },
    { message: "useful_life_years_required" }
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
    tax_treatment: getStr(formData, "tax_treatment"),
    expense_82b_years: getStr(formData, "expense_82b_years"),
    useful_life_years: getStr(formData, "useful_life_years"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Normalise treatment-specific years.
  const payload = {
    ...parsed.data,
    expense_82b_years:
      parsed.data.tax_treatment === "expense_82b"
        ? parsed.data.expense_82b_years
        : null,
    useful_life_years:
      parsed.data.tax_treatment === "capitalized_separate"
        ? parsed.data.useful_life_years
        : null,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_plans")
    .insert({ ...payload, property_id: propertyId });

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

/**
 * § 6 Abs. 1 Nr. 1a EStG bulk requalification — picks all investments in
 * the 3-year window after `transfer_year` that are currently classified
 * as expense_immediate or expense_82b and re-tags them as
 * `capitalized_building` with `requalified_15pct = true`. Non-deductible
 * and already-capitalized rows are left alone.
 */
export async function requalifyAnschaffungsnaheHK(
  propertyId: string,
  transferYear: number
): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_plans")
    .update({
      tax_treatment: "capitalized_building",
      expense_82b_years: null,
      requalified_15pct: true,
    })
    .eq("property_id", propertyId)
    .in("tax_treatment", ["expense_immediate", "expense_82b"])
    .gte("year", transferYear)
    .lte("year", transferYear + 2)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath(`/objekte/${propertyId}/investitionen`);
  revalidatePath(`/investitionen`);
  return { count: (data ?? []).length };
}
