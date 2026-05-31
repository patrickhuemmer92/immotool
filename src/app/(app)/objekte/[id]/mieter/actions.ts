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

// Kaltmiete und Nebenkosten sind weiterhin Pflicht — pro Vertrag.
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

/**
 * Legt einen NEUEN Mietvertrag an. Pro Objekt sind mehrere Verträge
 * erlaubt (WGs, parallele Mieter, etc.) — die UNIQUE-Constraint auf
 * property_id wurde mit Migration 0018 entfernt.
 */
export async function createTenant(
  propertyId: string,
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const parsed = tenantSchema.safeParse(parse(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const payload = {
    ...parsed.data,
    contract_end: parsed.data.is_fixed_term ? parsed.data.contract_end : null,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .insert({ ...payload, property_id: propertyId });

  if (error) {
    console.error("[tenants:create] supabase error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      property_id: propertyId,
    });
    return { error: error.message };
  }

  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
  revalidatePath("/mieter");
  return undefined;
}

/**
 * Aktualisiert einen existierenden Mietvertrag anhand seiner tenant_id.
 */
export async function updateTenant(
  tenantId: string,
  propertyId: string,
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const parsed = tenantSchema.safeParse(parse(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const payload = {
    ...parsed.data,
    contract_end: parsed.data.is_fixed_term ? parsed.data.contract_end : null,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update(payload)
    .eq("id", tenantId);

  if (error) {
    console.error("[tenants:update] supabase error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      tenant_id: tenantId,
    });
    return { error: error.message };
  }

  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
  revalidatePath("/mieter");
  return undefined;
}

/**
 * Löscht einen Mietvertrag anhand seiner tenant_id. Wir nehmen die
 * property_id als zusätzliches Argument, um die richtigen Caches zu
 * invalidieren — Lookup via DB wäre ein zusätzlicher Roundtrip.
 */
export async function deleteTenant(tenantId: string, propertyId: string) {
  const supabase = await createClient();
  await supabase.from("tenants").delete().eq("id", tenantId);
  revalidatePath(`/objekte/${propertyId}/mieter`);
  revalidatePath(`/objekte/${propertyId}`);
  revalidatePath("/mieter");
}
