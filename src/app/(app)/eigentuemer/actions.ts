"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type OwnerFormState = { error?: string } | undefined;

const schema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  tax_id: z.string().optional(),
  notes: z.string().optional(),
});

export async function createOwner(
  _prev: OwnerFormState,
  formData: FormData
): Promise<OwnerFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    tax_id: formData.get("tax_id") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("owners")
    .insert({ ...parsed.data, workspace_id: active.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/eigentuemer");
  redirect(`/eigentuemer/${data.id}`);
}

export async function updateOwner(
  id: string,
  _prev: OwnerFormState,
  formData: FormData
): Promise<OwnerFormState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    tax_id: formData.get("tax_id") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/eigentuemer");
  revalidatePath(`/eigentuemer/${id}`);
  return undefined;
}

export async function deleteOwner(id: string) {
  const supabase = await createClient();
  await supabase.from("owners").delete().eq("id", id);
  revalidatePath("/eigentuemer");
  redirect("/eigentuemer");
}
