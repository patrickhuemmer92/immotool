"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type TenantFormState = { error?: string } | undefined;

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

const optScore = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      throw new Error("score_range");
    }
    return n;
  });

const tenantSchema = z.object({
  name: z.string().min(1, "name_required"),
  contract_start: optDate,
  family_status: optScore,
  schufa: optScore,
  rental_duration: optScore,
  personal_impression: optScore,
  employment_status: optScore,
  income_level: optScore,
  notes: z.string().optional().transform((v) => (v && v.length ? v : null)),
});

function parse(formData: FormData) {
  const obj: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of [
    "name",
    "contract_start",
    "family_status",
    "schufa",
    "rental_duration",
    "personal_impression",
    "employment_status",
    "income_level",
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
  let parsed;
  try {
    parsed = tenantSchema.safeParse(parse(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse_error" };
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .upsert(
      { ...parsed.data, property_id: propertyId },
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
