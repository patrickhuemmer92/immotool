"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { requireUser } from "@/lib/auth";
import { isDdAdmin } from "@/lib/dd/admin";
import { getPremiumStatus } from "@/lib/billing/premium";
import { PROPERTY_TYPES } from "@/lib/dd/property-type";
import { NOTE_SOURCES } from "@/lib/dd/notes";

export type DdProjectState = { error?: string } | undefined;

const projectSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(200),
  address_hint: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : null)),
  property_type: z.enum(PROPERTY_TYPES),
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
    property_type: formData.get("property_type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();

  // Premium-User bekommen DD-Analysen inklusive — kein 29-€-Kauf.
  // Wir markieren das direkt beim Anlegen als paid mit einem
  // erkennbaren Marker (kein echter Stripe-Payment-Intent).
  const premium = await getPremiumStatus(active.id);
  const premiumUnlock = premium.hasPaidSubscription;

  const { data, error } = await supabase
    .from("dd_projects")
    .insert({
      workspace_id: active.id,
      name: parsed.data.name,
      address_hint: parsed.data.address_hint,
      property_type: parsed.data.property_type,
      status: "draft",
      paid: premiumUnlock,
      paid_at: premiumUnlock ? new Date().toISOString() : null,
      stripe_payment_intent_id: premiumUnlock
        ? `PREMIUM_UNLOCK_${active.id.slice(0, 8)}_${Date.now()}`
        : null,
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

/**
 * Test-Bypass für die DD-Paywall.
 *
 * Nur Nutzer mit einer E-Mail in DD_ADMIN_EMAILS dürfen das aufrufen —
 * Server-seitige Verifikation, verlässt sich NICHT auf den Client-Guard
 * in der UI. Setzt paid=true mit erkennbarem Marker im
 * stripe_payment_intent_id, damit der Test-Kauf im Audit klar von
 * echten Käufen unterscheidbar bleibt.
 */
export async function unlockDdForTest(
  projectId: string
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!isDdAdmin(user.email)) return { error: "not_authorized" };

  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const supabase = await createClient();
  const marker = `TEST_BYPASS_${(user.email ?? "unknown").replace(
    /[^a-zA-Z0-9._@-]/g,
    ""
  )}_${Date.now()}`;
  const { error } = await supabase
    .from("dd_projects")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: marker,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("workspace_id", active.id);

  if (error) return { error: error.message };

  revalidatePath(`/analyse/${projectId}`);
  return {};
}

/**
 * Freifeld „Zusätzliche Info" — fließt beim nächsten Analyze- und beim
 * externen Dossier-Call ins User-Prompt ein.
 */
const noteSchema = z.object({
  note: z.string().trim().min(1, "note_required").max(2000),
  source: z.enum(NOTE_SOURCES),
  // Datum des Gespraechs. Leer = heute; Zukunft waere ein Tippfehler.
  occurred_on: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "invalid_date")
    .refine(
      (v) => v === null || v <= new Date().toISOString().slice(0, 10),
      "date_in_future"
    ),
});

/**
 * Gespraechsnotiz anlegen (Migration 0032).
 *
 * Invalidiert den Dossier-Cache: das externe Dossier liest die Notizen
 * mit, ein gespeichertes public_dossier_json waere danach veraltet.
 * Die Analyse selbst wird NICHT automatisch neu gerechnet — das kostet
 * und soll eine bewusste Entscheidung bleiben.
 */
export async function addProjectNote(
  projectId: string,
  input: { note: string; source: string; occurred_on?: string }
): Promise<{ error?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  const user = await requireUser();

  // Projektzugehoerigkeit pruefen, bevor wir schreiben — die RLS-Policy
  // deckt das ab, aber so bekommt der Aufrufer eine klare Meldung.
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return { error: "not_found" };

  const { error } = await supabase.from("dd_project_notes").insert({
    dd_project_id: projectId,
    note: parsed.data.note,
    source: parsed.data.source,
    ...(parsed.data.occurred_on ? { occurred_on: parsed.data.occurred_on } : {}),
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await invalidateDossierCache(supabase, projectId, active.id);
  revalidateAnalysePaths(projectId);
  return {};
}

export async function deleteProjectNote(
  projectId: string,
  noteId: string
): Promise<{ error?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dd_project_notes")
    .delete()
    .eq("id", noteId)
    .eq("dd_project_id", projectId);
  if (error) return { error: error.message };

  await invalidateDossierCache(supabase, projectId, active.id);
  revalidateAnalysePaths(projectId);
  return {};
}

/** Beide Seiten zeigen die Notizen — beide Pfade muessen frisch werden. */
function revalidateAnalysePaths(projectId: string) {
  revalidatePath(`/analyse/${projectId}`);
  revalidatePath(`/analyse/${projectId}/ergebnis`);
}

async function invalidateDossierCache(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  workspaceId: string
) {
  await supabase
    .from("dd_projects")
    .update({ public_dossier_json: null, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("workspace_id", workspaceId);
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
