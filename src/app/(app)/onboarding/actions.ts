"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getPremiumStatus } from "@/lib/billing/premium";
import { requireUser } from "@/lib/auth";
import { isDdAdmin } from "@/lib/dd/admin";
import type {
  KaufvertragExtraction,
  MietvertragExtraction,
  DarlehensvertragExtraction,
} from "@/lib/dd/schemas/onboarding";

export type OnboardingState = { error?: string } | undefined;

const projectSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(200),
});

export async function createOnboardingProject(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = projectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();

  // Unlock-Logik (Option A: „First-Object-Free" + Premium-inclusive):
  //   - Premium-User (hasPaidSubscription): immer inklusive
  //   - Alle anderen: das ERSTE je erzeugte Onboarding-Projekt im
  //     Workspace ist gratis. Ab dem zweiten muss 29 € gezahlt werden.
  //     Wir zählen ALLE historischen Projekte (auch archived), sonst
  //     könnte man durch Archivieren + Neuanlegen First-Free farmen.
  const premium = await getPremiumStatus(active.id);
  const { count: existingCount } = await supabase
    .from("onboarding_projects")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", active.id);
  const isFirstOnboarding = (existingCount ?? 0) === 0;
  const unlock = premium.hasPaidSubscription || isFirstOnboarding;

  const { data, error } = await supabase
    .from("onboarding_projects")
    .insert({
      workspace_id: active.id,
      name: parsed.data.name,
      status: "draft",
      premium_unlock: unlock,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  redirect(`/onboarding/${data.id}`);
}

const registerDocSchema = z.object({
  onboarding_project_id: z.string().uuid(),
  kind: z.enum([
    "kaufvertrag",
    "mietvertrag",
    "darlehensvertrag",
    "grundbuchauszug",
    "other",
  ]),
  filename: z.string().min(1).max(500),
  storage_path: z.string().min(1).max(1000),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
});

export async function registerOnboardingDocument(input: {
  onboarding_project_id: string;
  kind: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}): Promise<{ error?: string; documentId?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = registerDocSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, workspace_id")
    .eq("id", parsed.data.onboarding_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return { error: "project_not_found" };

  const { data, error } = await supabase
    .from("onboarding_documents")
    .insert({
      onboarding_project_id: parsed.data.onboarding_project_id,
      kind: parsed.data.kind,
      filename: parsed.data.filename,
      storage_path: parsed.data.storage_path,
      mime_type: parsed.data.mime_type,
      size_bytes: parsed.data.size_bytes,
      ocr_status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/onboarding/${parsed.data.onboarding_project_id}`);
  return { documentId: data.id };
}

export async function deleteOnboardingDocument(
  docId: string,
  projectId: string
): Promise<void> {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("onboarding_documents")
    .select(
      "storage_path, onboarding_projects!inner(workspace_id)"
    )
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return;

  const wsId = (doc as unknown as { onboarding_projects: { workspace_id: string } })
    .onboarding_projects?.workspace_id;
  if (wsId !== active.id) return;

  const storagePath = (doc as unknown as { storage_path: string }).storage_path;
  await supabase.storage.from("dd-documents").remove([storagePath]);
  await supabase.from("onboarding_documents").delete().eq("id", docId);

  revalidatePath(`/onboarding/${projectId}`);
}

/**
 * Nach dem Confirm: aus den Extraktionen echte Rows in
 * properties / loans / tenants schreiben und die IDs zurück ans
 * Onboarding-Projekt hängen.
 *
 * v1: keine Sub-Property-Erzeugung bei MFH — der User bekommt ein
 * einzelnes Property angelegt, mit Notes-Hinweis auf die Einheiten;
 * die Sub-Property-Anlage kann er über die bestehenden Inline-Actions
 * durchführen. Sonst würde die Onboarding-Route zu breit.
 */
export async function confirmOnboarding(
  projectId: string
): Promise<{ error?: string; propertyId?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select(
      "id, workspace_id, status, extracted_summary, created_property_id, paid, premium_unlock"
    )
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return { error: "project_not_found" };

  if (!project.paid && !project.premium_unlock) {
    return { error: "payment_required" };
  }
  if (project.created_property_id) {
    return { propertyId: project.created_property_id };
  }
  if (!project.extracted_summary) {
    return { error: "no_extraction" };
  }

  const summary = project.extracted_summary as {
    kauf?: KaufvertragExtraction;
    miete?: MietvertragExtraction[];
    darlehen?: DarlehensvertragExtraction[];
  };
  const kauf = summary.kauf;

  if (!kauf?.street || !kauf?.postal_code || !kauf?.city) {
    return { error: "address_missing" };
  }

  // Kind-Mapping (Property-Schema hat kein row_house)
  const kindMap: Record<string, string> = {
    apartment: "apartment",
    house: "house",
    row_house: "house",
    commercial: "commercial",
    parking: "parking",
    other: "other",
  };
  const kind = kauf.kind && kindMap[kauf.kind] ? kindMap[kauf.kind] : "apartment";

  // ---- MFH-Erkennung ------------------------------------------------
  // Wenn is_multi_family + unit_count > 1: das Haupt-Property wird ein
  // "house", und wir legen unit_count Sub-Properties (kind=apartment)
  // an. Die Mietverträge weiter unten werden dann per unit_reference
  // an die passende Sub-Property gehängt (Fallback: 1. unbenutzte).
  const isMfh =
    !!kauf.is_multi_family && !!kauf.unit_count && kauf.unit_count > 1;
  const unitCount = isMfh ? Math.min(kauf.unit_count!, 200) : 0;
  const mainKind = isMfh ? "house" : kind;

  const notesParts: string[] = ["Angelegt via KI-Onboarding."];
  if (isMfh) {
    notesParts.push(
      `Mehrfamilienhaus mit ${unitCount} Wohneinheiten — Sub-Wohnungen wurden automatisch angelegt (siehe Untereinheiten unten).`
    );
  }

  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .insert({
      workspace_id: active.id,
      kind: mainKind,
      street: kauf.street,
      postal_code: kauf.postal_code,
      city: kauf.city,
      location_detail: kauf.location_detail ?? null,
      sqm: kauf.living_area_sqm ?? null,
      purchase_price: kauf.purchase_price_eur ?? null,
      notary_appointment: kauf.notary_appointment ?? null,
      transfer_date: kauf.transfer_date ?? null,
      registration_date: kauf.registration_date ?? null,
      transfer_tax: kauf.transfer_tax_eur ?? null,
      broker_fee: kauf.broker_fee_eur ?? null,
      notary_fee: kauf.notary_fee_eur ?? null,
      registration_cost: kauf.registration_cost_eur ?? null,
      land_value: kauf.land_value_eur ?? null,
      building_value_share_pct:
        kauf.building_value_share_pct != null
          ? kauf.building_value_share_pct / 100
          : null,
      notes: notesParts.join(" "),
    })
    .select("id")
    .single();
  if (propErr) return { error: propErr.message };

  // ---- Sub-Properties für MFH-Wohneinheiten ------------------------
  // Wir legen unit_count Apartments an, jedes mit parent_property_id =
  // Haupt-Property. Die Wohnungsnummer nutzen wir als unit_number
  // (String "1", "2", …) und als location_detail ("Wohnung Nr. N").
  // Kaufpreis wird gleichmäßig aufgeteilt, wenn wir keine bessere
  // Information haben — das ist eine Näherung, die der User später
  // pro Wohnung einzeln korrigieren kann.
  const subPropertyUnitMap: Array<{ id: string; unit_number: string }> = [];
  if (isMfh) {
    const perUnitPrice =
      kauf.purchase_price_eur != null
        ? Math.round(kauf.purchase_price_eur / unitCount)
        : null;
    const perUnitSqm =
      kauf.living_area_sqm != null
        ? Math.round((kauf.living_area_sqm / unitCount) * 10) / 10
        : null;

    for (let i = 1; i <= unitCount; i++) {
      const unitNumber = String(i);
      const { data: sub } = await supabase
        .from("properties")
        .insert({
          workspace_id: active.id,
          kind: "apartment",
          parent_property_id: prop.id,
          street: kauf.street,
          postal_code: kauf.postal_code,
          city: kauf.city,
          unit_number: unitNumber,
          location_detail: `Wohnung ${unitNumber}`,
          sqm: perUnitSqm,
          purchase_price: perUnitPrice,
          notes:
            "Sub-Einheit automatisch aus KI-Onboarding angelegt. " +
            "Fläche und Kaufpreis anteilig geschätzt — bitte prüfen.",
        })
        .select("id")
        .single();
      if (sub?.id) {
        subPropertyUnitMap.push({ id: sub.id, unit_number: unitNumber });
      }
    }
  }

  // ---- Darlehen: bleiben am Haupt-Property -------------------------
  // Ein Baufi-Darlehen deckt in der Regel das gesamte Objekt ab. Wir
  // ordnen es NICHT den Sub-Wohnungen zu — der User kann es später
  // manuell splitten falls gewünscht.
  const loanIds: string[] = [];
  for (const l of summary.darlehen ?? []) {
    if (!l.loan_amount_eur || !l.disbursement_date || !l.first_payment_date)
      continue;
    const { data: loanRow } = await supabase
      .from("loans")
      .insert({
        property_id: prop.id,
        designation: l.designation ?? "Annuitätendarlehen",
        bank: l.bank ?? null,
        loan_number: l.loan_number ?? null,
        loan_amount: l.loan_amount_eur,
        interest_rate_pa:
          l.interest_rate_pa_pct != null ? l.interest_rate_pa_pct / 100 : 0,
        amortization_pa:
          l.amortization_pa_pct != null ? l.amortization_pa_pct / 100 : 0,
        disbursement_date: l.disbursement_date,
        first_payment_date: l.first_payment_date,
        rate_lock_until: l.rate_lock_until ?? null,
        maturity_date: l.maturity_date ?? null,
        interest_share_first_rate: l.interest_share_first_rate_eur ?? null,
      })
      .select("id")
      .single();
    if (loanRow?.id) loanIds.push(loanRow.id);
  }

  // ---- Mietverträge: bei MFH an Sub-Wohnung zuordnen ---------------
  // Matching-Regel:
  //   1. unit_reference enthält Zahl → matcht Sub mit unit_number
  //      (Substring/Regex — "Whg. 3", "Wohnung Nr. 3", "3. OG" …)
  //   2. Fallback: erste noch nicht belegte Sub-Wohnung
  //   3. Wenn kein MFH oder keine Subs mehr frei: Haupt-Property
  const tenantIds: string[] = [];
  const takenSubs = new Set<string>();
  const parseUnitFromRef = (ref: string | null): string | null => {
    if (!ref) return null;
    const m = ref.match(/\b(\d{1,3})\b/);
    return m ? m[1] : null;
  };

  for (const t of summary.miete ?? []) {
    if (!t.tenant_name) continue;

    let targetPropertyId = prop.id;
    if (isMfh && subPropertyUnitMap.length > 0) {
      const wanted = parseUnitFromRef(t.unit_reference ?? null);
      let match = wanted
        ? subPropertyUnitMap.find(
            (s) => s.unit_number === wanted && !takenSubs.has(s.id)
          )
        : undefined;
      if (!match) {
        // Fallback: erste noch nicht belegte Sub
        match = subPropertyUnitMap.find((s) => !takenSubs.has(s.id));
      }
      if (match) {
        targetPropertyId = match.id;
        takenSubs.add(match.id);
      }
    }

    const { data: tenantRow } = await supabase
      .from("tenants")
      .insert({
        property_id: targetPropertyId,
        name: t.tenant_name,
        contract_start: t.contract_start ?? null,
        is_fixed_term: t.is_fixed_term ?? false,
        contract_end: t.is_fixed_term ? t.contract_end ?? null : null,
        cold_rent_per_month: t.cold_rent_per_month_eur ?? 0,
        ancillary_costs_per_month: t.ancillary_costs_per_month_eur ?? 0,
        notes: t.rent_adjustments_notes ?? null,
      })
      .select("id")
      .single();
    if (tenantRow?.id) tenantIds.push(tenantRow.id);
  }

  await supabase
    .from("onboarding_projects")
    .update({
      status: "confirmed",
      created_property_id: prop.id,
      created_loan_ids: loanIds,
      created_tenant_ids: tenantIds,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  revalidatePath("/onboarding");
  revalidatePath("/objekte");
  return { propertyId: prop.id };
}

/**
 * Test-Bypass für die Onboarding-Paywall — analog zu unlockDdForTest.
 * Nur für ENV-whitelisted Admin-Emails.
 */
export async function unlockOnboardingForTest(
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
    .from("onboarding_projects")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: marker,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("workspace_id", active.id);

  if (error) return { error: error.message };

  revalidatePath(`/onboarding/${projectId}`);
  return {};
}

export async function archiveOnboarding(projectId: string) {
  const active = await getActiveWorkspace();
  if (!active) return;
  const supabase = await createClient();
  await supabase
    .from("onboarding_projects")
    .update({ status: "archived" })
    .eq("id", projectId)
    .eq("workspace_id", active.id);
  revalidatePath("/onboarding");
  redirect("/onboarding");
}

/**
 * Hartes Löschen eines Onboarding-Projekts inkl. aller Dokumente.
 * Storage-Files werden mit-gelöscht. Redirect zur Liste; wenn von
 * der Liste selbst aufgerufen, nur revalidate.
 *
 * Wichtig: eine bereits erstellte `properties`-Row (nach Confirm)
 * bleibt bestehen — das echte Objekt löschen wir NICHT.
 */
export async function deleteOnboardingProject(
  projectId: string,
  opts: { redirectToList?: boolean } = { redirectToList: true }
) {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();

  // Storage-Files einsammeln damit wir sie mit-löschen können.
  const { data: docs } = await supabase
    .from("onboarding_documents")
    .select("storage_path")
    .eq("onboarding_project_id", projectId);
  const paths = (docs ?? []).map((d) => d.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from("dd-documents").remove(paths);
  }

  await supabase
    .from("onboarding_projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", active.id);

  revalidatePath("/onboarding");
  if (opts.redirectToList) {
    redirect("/onboarding");
  }
}

export async function saveOnboardingEdit(
  projectId: string,
  patch: {
    kauf?: Partial<KaufvertragExtraction>;
    miete?: MietvertragExtraction[];
    darlehen?: DarlehensvertragExtraction[];
  }
): Promise<{ error?: string }> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, extracted_summary")
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return { error: "project_not_found" };

  const current = (project.extracted_summary ?? {}) as {
    kauf?: KaufvertragExtraction;
    miete?: MietvertragExtraction[];
    darlehen?: DarlehensvertragExtraction[];
  };
  const merged = {
    kauf: patch.kauf ? { ...current.kauf, ...patch.kauf } : current.kauf,
    miete: patch.miete ?? current.miete ?? [],
    darlehen: patch.darlehen ?? current.darlehen ?? [],
  };

  const { error } = await supabase
    .from("onboarding_projects")
    .update({
      extracted_summary: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/onboarding/${projectId}`);
  return {};
}
