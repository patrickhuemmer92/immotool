"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { parseDecimal } from "@/lib/format";

export type PropertyFormState = { error?: string } | undefined;

const optString = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

/** Optional decimal stored as-is (e.g. 1234.56). German "1.234,56" supported. */
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

/**
 * Optional percent input — user enters "2,5" for 2.5 %, stored as 0.025.
 * Range guard: 0–100 inclusive.
 */
const optPercentInput = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    const n = parseDecimal(v);
    if (n === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_percent:${v}`,
      });
      return;
    }
    if (n < 0 || n > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_percent:${v}`,
      });
    }
  })
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = parseDecimal(v);
    return n === null ? null : n / 100;
  });

const propertySchema = z.object({
  street: z.string().min(1, "street_required"),
  postal_code: z.string().min(1, "postal_code_required"),
  city: z.string().min(1, "city_required"),
  location_detail: optString,
  description: optString,
  unit_number: optString,
  sqm: optNumber,
  notary_appointment: optDate,
  transfer_date: optDate,
  registration_date: optDate,
  purchase_price: optNumber,
  transfer_tax: optNumber,
  broker_fee: optNumber,
  notary_fee: optNumber,
  registration_cost: optNumber,
  land_value: optNumber,
  building_value_share_pct: optPercentInput,
  depreciation_rate: optPercentInput,
  notes: optString,
});

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

function readForm(formData: FormData) {
  return {
    street: getStr(formData, "street"),
    postal_code: getStr(formData, "postal_code"),
    city: getStr(formData, "city"),
    location_detail: getStr(formData, "location_detail"),
    description: getStr(formData, "description"),
    unit_number: getStr(formData, "unit_number"),
    sqm: getStr(formData, "sqm"),
    notary_appointment: getStr(formData, "notary_appointment"),
    transfer_date: getStr(formData, "transfer_date"),
    registration_date: getStr(formData, "registration_date"),
    purchase_price: getStr(formData, "purchase_price"),
    transfer_tax: getStr(formData, "transfer_tax"),
    broker_fee: getStr(formData, "broker_fee"),
    notary_fee: getStr(formData, "notary_fee"),
    registration_cost: getStr(formData, "registration_cost"),
    land_value: getStr(formData, "land_value"),
    building_value_share_pct: getStr(formData, "building_value_share_pct"),
    depreciation_rate: getStr(formData, "depreciation_rate"),
    notes: getStr(formData, "notes"),
  };
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = propertySchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...parsed.data, workspace_id: active.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/objekte");
  redirect(`/objekte/${data.id}`);
}

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const parsed = propertySchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/objekte");
  revalidatePath(`/objekte/${id}`);
  revalidatePath(`/objekte/${id}/bearbeiten`);
  return undefined;
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  await supabase.from("properties").delete().eq("id", id);
  revalidatePath("/objekte");
  redirect("/objekte");
}
