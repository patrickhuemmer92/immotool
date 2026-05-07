"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoanFormState = { error?: string } | undefined;

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

const optNumber = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) throw new Error(`invalid_number:${v}`);
    return n;
  });

const requiredNumber = z.string().transform((v) => {
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`invalid_number:${v}`);
  return n;
});

const loanSchema = z.object({
  designation: z.string().min(1, "designation_required"),
  bank: z.string().optional().transform((v) => (v && v.length ? v : null)),
  loan_number: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  disbursement_date: z.string().min(1, "disbursement_date_required"),
  loan_amount: requiredNumber,
  interest_rate_pa: requiredNumber,
  amortization_pa: requiredNumber,
  first_payment_date: z.string().min(1, "first_payment_date_required"),
  rate_lock_until: optDate,
  interest_share_first_rate: optNumber,
  notes: z.string().optional().transform((v) => (v && v.length ? v : null)),
});

function readForm(formData: FormData) {
  const obj: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of [
    "designation",
    "bank",
    "loan_number",
    "disbursement_date",
    "loan_amount",
    "interest_rate_pa",
    "amortization_pa",
    "first_payment_date",
    "rate_lock_until",
    "interest_share_first_rate",
    "notes",
  ]) {
    const v = formData.get(k);
    obj[k] = v === null ? undefined : v;
  }
  return obj;
}

export async function createLoan(
  propertyId: string,
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  let parsed;
  try {
    parsed = loanSchema.safeParse(readForm(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
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
  let parsed;
  try {
    parsed = loanSchema.safeParse(readForm(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
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
  let parsed;
  try {
    parsed = specialRepaymentSchema.safeParse({
      payment_date: formData.get("payment_date"),
      amount: formData.get("amount"),
      description: formData.get("description"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
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
