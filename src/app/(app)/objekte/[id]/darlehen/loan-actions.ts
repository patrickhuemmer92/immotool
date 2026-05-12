"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type LoanFormState = { error?: string } | undefined;

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

const optNumber = z
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

const requiredNumber = z
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

/** User enters percent value (e.g. "4,01" → 0.0401 stored). */
const requiredPercent = z
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

const loanSchema = z.object({
  designation: z.string().min(1, "designation_required"),
  bank: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  loan_number: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  disbursement_date: z.string().min(1, "disbursement_date_required"),
  loan_amount: requiredNumber,
  interest_rate_pa: requiredPercent,
  amortization_pa: requiredPercent,
  first_payment_date: z.string().min(1, "first_payment_date_required"),
  rate_lock_until: optDate,
  interest_share_first_rate: optNumber,
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

function readForm(formData: FormData) {
  return {
    designation: getStr(formData, "designation"),
    bank: getStr(formData, "bank"),
    loan_number: getStr(formData, "loan_number"),
    disbursement_date: getStr(formData, "disbursement_date"),
    loan_amount: getStr(formData, "loan_amount"),
    interest_rate_pa: getStr(formData, "interest_rate_pa"),
    amortization_pa: getStr(formData, "amortization_pa"),
    first_payment_date: getStr(formData, "first_payment_date"),
    rate_lock_until: getStr(formData, "rate_lock_until"),
    interest_share_first_rate: getStr(formData, "interest_share_first_rate"),
    notes: getStr(formData, "notes"),
  };
}

export async function createLoan(
  propertyId: string,
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const parsed = loanSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loans")
    .insert({ ...parsed.data, property_id: propertyId })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/darlehen`);
  redirect(`/objekte/${propertyId}/darlehen/${data.id}`);
}

export async function updateLoan(
  loanId: string,
  propertyId: string,
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const parsed = loanSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("loans")
    .update(parsed.data)
    .eq("id", loanId);

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/darlehen`);
  revalidatePath(`/objekte/${propertyId}/darlehen/${loanId}`);
  return undefined;
}

export async function deleteLoan(loanId: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("loans").delete().eq("id", loanId);
  revalidatePath(`/objekte/${propertyId}/darlehen`);
  redirect(`/objekte/${propertyId}/darlehen`);
}

const specialRepaymentSchema = z.object({
  payment_date: z.string().min(1),
  amount: requiredNumber,
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

export async function addSpecialRepayment(
  loanId: string,
  propertyId: string,
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const parsed = specialRepaymentSchema.safeParse({
    payment_date: getStr(formData, "payment_date"),
    amount: getStr(formData, "amount"),
    description: getStr(formData, "description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("special_repayments").insert({
    loan_id: loanId,
    ...parsed.data,
  });

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/darlehen/${loanId}`);
  return undefined;
}

export async function deleteSpecialRepayment(
  id: string,
  loanId: string,
  propertyId: string
) {
  const supabase = await createClient();
  await supabase.from("special_repayments").delete().eq("id", id);
  revalidatePath(`/objekte/${propertyId}/darlehen/${loanId}`);
}
