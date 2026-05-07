"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type PropertyFormState = { error?: string } | undefined;

const optString = z.string().optional().transform((v) => (v && v.length ? v : null));
const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

const optNumber = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return null;
    const normalized = v.replace(",", ".");
    const n = Number(normalized);
    if (!Number.isFinite(n)) {
      throw new Error(`invalid_number:${v}`);
    }
    return n;
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
  funding_cost: optNumber,
  land_value: optNumber,
  building_value_share_pct: optNumber,
  depreciation_rate: optNumber,
  notes: optString,
});

function parseFormData(formData: FormData) {
  const obj: Record<string, FormDataEntryValue | undefined> = {};
  for (const key of [
    "street",
    "postal_code",
    "city",
    "location_detail",
    "description",
    "unit_number",
    "sqm",
    "notary_appointment",
    "transfer_date",
    "registration_date",
    "purchase_price",
    "transfer_tax",
    "broker_fee",
    "notary_fee",
    "registration_cost",
    "funding_cost",
    "land_value",
    "building_value_share_pct",
    "depreciation_rate",
    "notes",
  ]) {
    const v = formData.get(key);
    obj[key] = v === null ? undefined : v;
  }
  return obj;
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  let parsed;
  try {
    parsed = propertySchema.safeParse(parseFormData(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
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
  let parsed;
  try {
    parsed = propertySchema.safeParse(parseFormData(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
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
