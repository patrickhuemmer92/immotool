"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type RentalContractFormState = { error?: string } | undefined;

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

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

const schema = z
  .object({
    tenant_name: z.string().min(1, "tenant_name_required"),
    contract_start: z.string().min(1, "contract_start_required"),
    is_fixed_term: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    contract_end: optDate,
    cold_rent_per_month: optNum,
    notes: z
      .string()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
  })
  .superRefine((d, ctx) => {
    if (d.is_fixed_term && !d.contract_end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contract_end_required_if_fixed_term",
        path: ["contract_end"],
      });
    }
    if (!d.is_fixed_term && d.contract_end) {
      // open-ended contract: ignore stray end date
    }
    if (d.contract_end && d.contract_end < d.contract_start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contract_end_before_start",
        path: ["contract_end"],
      });
    }
  });

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : (v as string);
  };
  return {
    tenant_name: get("tenant_name"),
    contract_start: get("contract_start"),
    is_fixed_term: get("is_fixed_term"),
    contract_end: get("contract_end"),
    cold_rent_per_month: get("cold_rent_per_month"),
    notes: get("notes"),
  };
}

export async function createRentalContract(
  propertyId: string,
  _prev: RentalContractFormState,
  formData: FormData
): Promise<RentalContractFormState> {
  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Normalize: if not fixed-term, clear contract_end (defensive).
  const payload = {
    ...parsed.data,
    contract_end: parsed.data.is_fixed_term ? parsed.data.contract_end : null,
    property_id: propertyId,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("rental_contracts").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
  return undefined;
}

export async function updateRentalContract(
  id: string,
  propertyId: string,
  _prev: RentalContractFormState,
  formData: FormData
): Promise<RentalContractFormState> {
  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const payload = {
    ...parsed.data,
    contract_end: parsed.data.is_fixed_term ? parsed.data.contract_end : null,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rental_contracts")
    .update(payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
  return undefined;
}

export async function deleteRentalContract(id: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("rental_contracts").delete().eq("id", id);
  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
}
