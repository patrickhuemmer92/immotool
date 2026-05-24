"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/format";

export type TenantFormState = { error?: string } | undefined;

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

// Kaltmiete and ancillary costs are now mandatory at the tenant level; the
// old optional-number schema is no longer used.
const requiredNum = z
  .string()
  .superRefine((v, ctx) => {
    if (!v || !v.length || parseDecimal(v) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v ?? ""}`,
      });
    }
  })
  .transform((v) => parseDecimal(v) as number);

const tenantSchema = z
  .object({
    name: z.string().min(1, "name_required"),
    contract_start: optDate,
    is_fixed_term: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    contract_end: optDate,
    cold_rent_per_month: requiredNum,
    ancillary_costs_per_month: requiredNum,
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
    if (
      d.is_fixed_term &&
      d.contract_end &&
      d.contract_start &&
      d.contract_end < d.contract_start
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contract_end_before_start",
        path: ["contract_end"],
      });
    }
  });

function parse(formData: FormData) {
  const obj: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of [
    "name",
    "contract_start",
    "is_fixed_term",
    "contract_end",
    "cold_rent_per_month",
    "ancillary_costs_per_month",
    "notes",
  ]) {
    const v = formData.get(k);
    obj[k] = v === null ? undefined : v;
  }
  return obj;
}

export async function upsertTenant(
  propertyId: string,
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const parsed = tenantSchema.safeParse(parse(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Defensive: clear contract_end if not fixed-term.
  const payload = {
    ...parsed.data,
    contract_end: parsed.data.is_fixed_term ? parsed.data.contract_end : null,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .upsert(
      { ...payload, property_id: propertyId },
      { onConflict: "property_id" }
    );

  if (error) return { error: error.message };

  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
  return undefined;
}

export async function deleteTenant(propertyId: string) {
  const supabase = await createClient();
  await supabase.from("tenants").delete().eq("property_id", propertyId);
  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
}
