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
    .from("dd_projects")
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
    .from("dd_projects")
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
    .from("dd_projects")
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
    .from("dd_projects")
    .update({ status: "archived" })
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/analyse");
  redirect("/analyse");
}

/**
 * Nutzer-Korrekturen an den extrahierten Exposé-Werten speichern.
 * Übergabe ist ein Partial des Exposé-Extraction-JSON — wir mergen es
 * mit dem bestehenden JSON in `dd_projects.extracted_expose`, damit
 * Nutzer einzelne Felder korrigieren können ohne den Rest zu berühren.
 */
export async function saveExtractedExposeEdit(
  projectId: string,
  patch: Record<string, unknown>
): Promise<{ error?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, extracted_expose")
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();

  if (!project) return { error: "project_not_found" };

  const current =
    (project.extracted_expose as Record<string, unknown> | null) ?? {};
  const merged = { ...current, ...patch };

  const { error } = await supabase
    .from("dd_projects")
    .update({
      extracted_expose: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/analyse/${projectId}`);
  return {};
}

export async function deleteDdProject(projectId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();
  await supabase
    .from("dd_projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/analyse");
  redirect("/analyse");
}
