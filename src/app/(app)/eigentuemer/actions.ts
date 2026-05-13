"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type OwnerFormState = { error?: string } | undefined;

const baseFields = {
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
};

const personSchema = z.object({
  kind: z.literal("person"),
  first_name: z.string().min(1, "first_name_required"),
  last_name: z.string().min(1, "last_name_required"),
  ...baseFields,
});

const groupSchema = z.object({
  kind: z.literal("group"),
  name: z.string().min(1, "name_required"),
  ...baseFields,
});

const ownerSchema = z.discriminatedUnion("kind", [personSchema, groupSchema]);

function readForm(formData: FormData) {
  const kind = String(formData.get("kind") ?? "person");
  return {
    kind,
    first_name: formData.get("first_name") ?? undefined,
    last_name: formData.get("last_name") ?? undefined,
    name: formData.get("name") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  };
}

export async function createOwner(
  _prev: OwnerFormState,
  formData: FormData
): Promise<OwnerFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = ownerSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const payload =
    parsed.data.kind === "person"
      ? {
          workspace_id: active.id,
          kind: "person" as const,
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          // The trigger auto-syncs `name`; the placeholder below is overwritten
          // before commit.
          name: `${parsed.data.first_name} ${parsed.data.last_name}`,
          notes: parsed.data.notes,
        }
      : {
          workspace_id: active.id,
          kind: "group" as const,
          name: parsed.data.name,
          notes: parsed.data.notes,
        };

  const { data, error } = await supabase
    .from("owners")
    .insert(payload as never)
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
  const parsed = ownerSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const payload =
    parsed.data.kind === "person"
      ? {
          kind: "person" as const,
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          notes: parsed.data.notes,
        }
      : {
          kind: "group" as const,
          name: parsed.data.name,
          notes: parsed.data.notes,
        };

  const { error } = await supabase
    .from("owners")
    .update(payload as never)
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

/** Add a person to a group. */
export async function addGroupMember(
  groupId: string,
  personId: string
): Promise<OwnerFormState> {
  if (!personId) return { error: "person_required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("owner_members")
    .insert({ group_owner_id: groupId, person_owner_id: personId });
  if (error) {
    if (error.code === "23505") return { error: "member_exists" };
    return { error: error.message };
  }
  revalidatePath(`/eigentuemer/${groupId}`);
  return undefined;
}

export async function removeGroupMember(memberRowId: string, groupId: string) {
  const supabase = await createClient();
  await supabase.from("owner_members").delete().eq("id", memberRowId);
  revalidatePath(`/eigentuemer/${groupId}`);
}
