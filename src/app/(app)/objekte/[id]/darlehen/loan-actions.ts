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
  maturity_date: optDate,
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
    maturity_date: getStr(formData, "maturity_date"),
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

/**
 * Inline-Variante von createLoan für das Quick-Action-Modal auf der
 * Property-Detail-Seite. Statt Redirect zur Loan-Detail-Seite liefern
 * wir die neue loanId zurück, damit der Client (typisch: revalidate +
 * Modal schließen) frei entscheiden kann, wohin der User springt.
 */
export type LoanInlineState =
  | { error: string }
  | { loanId: string }
  | undefined;

export async function createLoanInline(
  propertyId: string,
  _prev: LoanInlineState,
  formData: FormData
): Promise<LoanInlineState> {
  const parsed = loanSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loans")
    .insert({ ...parsed.data, property_id: propertyId })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}`);
  revalidatePath(`/objekte/${propertyId}/darlehen`);
  return { loanId: data.id };
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

// ---------------------------------------------------------------------
// Bulk-Sondertilgung: wiederkehrende Reihen
//
// Praxis-Insight: Sondertilgungspläne sind fast immer "jedes Jahr im
// gleichen Monat X €" (Bonus-Zahlung) oder "jedes Jahr X % der
// Original-Schuld" (Wenn Bank das limitiert). Statt 10 Einzeleinträge
// zu fragen, expandieren wir aus Pattern → N Inserts.
//
// Patterns (MVP):
//   - fixed     : fester Eurobetrag pro Jahr
//   - percent   : Prozent der Original-Darlehenssumme (Vereinfachung,
//                 unabhängig vom Restkapital — sonst müssten wir die
//                 ganze Tilgungsplan-Logik in den Server ziehen)
//
// Cap (optional): wenn die Summe der bereits eingeplanten Einträge das
// Cap überschreitet, wird der letzte Eintrag auf den Restbetrag
// zugeschnitten und die Reihe abgebrochen. Verhindert, dass ein
// schlecht gesetzter Endjahr-Wert den User überspart.
//
// Kollisionen: Wenn an einem geplanten Datum bereits ein Special
// existiert, wird dieser Eintrag stillschweigend übersprungen — der
// User kann Bulk + Einzeleinträge mischen, ohne dass die Action ihm
// das verbietet.
// ---------------------------------------------------------------------

const recurringSchema = z.object({
  mode: z.enum(["fixed", "percent"]),
  amount: optNumber,
  percent: z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (!v || !v.length) return;
      const n = parseDecimal(v);
      if (n === null || n < 0 || n > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `invalid_percent:${v}`,
        });
      }
    })
    .transform((v) => (v && v.length ? (parseDecimal(v) as number) / 100 : null)),
  start_year: requiredNumber,
  end_year: requiredNumber,
  month: requiredNumber,
  day: requiredNumber,
  cap_total: optNumber,
});

export async function addRecurringSpecialRepayments(
  loanId: string,
  propertyId: string,
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const parsed = recurringSchema.safeParse({
    mode: getStr(formData, "mode"),
    amount: getStr(formData, "amount"),
    percent: getStr(formData, "percent"),
    start_year: getStr(formData, "start_year"),
    end_year: getStr(formData, "end_year"),
    month: getStr(formData, "month"),
    day: getStr(formData, "day"),
    cap_total: getStr(formData, "cap_total"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const p = parsed.data;
  if (p.end_year < p.start_year) return { error: "end_before_start" };
  if (p.start_year < 1900 || p.end_year > 2200) {
    return { error: "year_out_of_range" };
  }
  if (p.month < 1 || p.month > 12) return { error: "invalid_month" };
  if (p.day < 1 || p.day > 28) return { error: "invalid_day" };

  const supabase = await createClient();

  // Original-Loan-Amount holen — für mode=percent brauchen wir die Basis.
  const { data: loanRow, error: loanErr } = await supabase
    .from("loans")
    .select("loan_amount")
    .eq("id", loanId)
    .maybeSingle();
  if (loanErr) return { error: loanErr.message };
  if (!loanRow) return { error: "loan_not_found" };
  const loanAmount = Number(loanRow.loan_amount);

  // Bestehende Termine lesen — zur Kollisionsprüfung.
  const { data: existing } = await supabase
    .from("special_repayments")
    .select("payment_date")
    .eq("loan_id", loanId);
  const existingDates = new Set(
    (existing ?? []).map((e) => String(e.payment_date))
  );

  const perEntry =
    p.mode === "fixed"
      ? p.amount ?? 0
      : (p.percent ?? 0) * loanAmount;
  if (perEntry <= 0) return { error: "amount_must_be_positive" };

  const monthIso = String(p.month).padStart(2, "0");
  const dayIso = String(p.day).padStart(2, "0");

  const rows: { loan_id: string; payment_date: string; amount: number }[] = [];
  let runningTotal = 0;

  for (let y = p.start_year; y <= p.end_year; y++) {
    const dateIso = `${y}-${monthIso}-${dayIso}`;
    if (existingDates.has(dateIso)) continue;

    let thisAmount = perEntry;
    if (p.cap_total != null) {
      const remaining = p.cap_total - runningTotal;
      if (remaining <= 0) break;
      if (thisAmount > remaining) thisAmount = remaining;
    }

    rows.push({ loan_id: loanId, payment_date: dateIso, amount: thisAmount });
    runningTotal += thisAmount;
  }

  if (rows.length === 0) return { error: "no_entries_generated" };

  const { error: insertErr } = await supabase
    .from("special_repayments")
    .insert(rows);

  if (insertErr) return { error: insertErr.message };

  revalidatePath(`/objekte/${propertyId}/darlehen/${loanId}`);
  return undefined;
}
