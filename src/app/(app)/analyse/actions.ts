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

/**
 * Nach dem Kauf: DD-Projekt in eine „echte" Property übertragen.
 * Legt aus dem extrahierten Exposé eine minimale Property an,
 * markiert das DD-Projekt als `promoted` und speichert den Rück-FK.
 *
 * Idempotent: wenn bereits promoviert, tut nichts.
 */
export async function promoteToProperty(
  projectId: string
): Promise<{ error?: string; propertyId?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, name, status, promoted_to_property_id, extracted_expose")
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return { error: "project_not_found" };

  if (project.promoted_to_property_id) {
    return { propertyId: project.promoted_to_property_id };
  }

  const exp = (project.extracted_expose ?? {}) as {
    kind?: string | null;
    street?: string | null;
    postal_code?: string | null;
    city?: string | null;
    purchase_price_eur?: number | null;
    living_area_sqm?: number | null;
    build_year?: number | null;
  };

  // Property braucht street/postal_code/city + kind — sonst kein
  // Promote möglich.
  if (!exp.street || !exp.postal_code || !exp.city) {
    return { error: "address_missing" };
  }

  // Kind mapping: DD-Enum ist teils identisch zu Property-Kind.
  // "row_house" gibts in Property-Schema nicht — mappen auf "house".
  const kindMap: Record<string, string> = {
    apartment: "apartment",
    house: "house",
    row_house: "house",
    commercial: "commercial",
    parking: "parking",
    other: "other",
  };
  const kind =
    exp.kind && kindMap[exp.kind] ? kindMap[exp.kind] : "apartment";

  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .insert({
      workspace_id: active.id,
      kind,
      street: exp.street,
      postal_code: exp.postal_code,
      city: exp.city,
      purchase_price: exp.purchase_price_eur ?? null,
      sqm: exp.living_area_sqm ?? null,
      notes:
        `Angelegt aus DD-Analyse „${project.name}". ` +
        `Weitere Felder aus dem Exposé kannst du in der Bearbeiten-Seite ergänzen.`,
    })
    .select("id")
    .single();

  if (propErr) return { error: propErr.message };

  await supabase
    .from("dd_projects")
    .update({
      status: "promoted",
      promoted_to_property_id: prop.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  revalidatePath("/analyse");
  revalidatePath(`/analyse/${projectId}`);
  revalidatePath("/objekte");
  return { propertyId: prop.id };
}
