"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type DdProjectState = { error?: string } | undefined;

const projectSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(200),
  address_hint: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : null)),
});

export async function createDdProject(
  _prev: DdProjectState,
  formData: FormData
): Promise<DdProjectState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    address_hint: formData.get("address_hint"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("due_diligence_projects")
    .insert({
      workspace_id: active.id,
      name: parsed.data.name,
      address_hint: parsed.data.address_hint,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/analyse");
  redirect(`/analyse/${data.id}`);
}

// -----------------------------------------------------------------
// Status-Übergänge (Watchlist / Promote / Archive)
// -----------------------------------------------------------------

export async function moveToWatchlist(projectId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();
  await supabase
    .from("due_diligence_projects")
    .update({ status: "watchlist" })
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/analyse");
  revalidatePath(`/analyse/${projectId}`);
}

export async function moveOutOfWatchlist(projectId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();
  await supabase
    .from("due_diligence_projects")
    .update({ status: "analyzed" })
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/analyse");
  revalidatePath(`/analyse/${projectId}`);
}

export async function archiveDdProject(projectId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();
  await supabase
    .from("due_diligence_projects")
    .update({ status: "archived" })
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/analyse");
  redirect("/analyse");
}

export async function deleteDdProject(projectId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();
  await supabase
    .from("due_diligence_projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/analyse");
  redirect("/analyse");
}
