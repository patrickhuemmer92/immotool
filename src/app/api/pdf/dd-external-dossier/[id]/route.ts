/**
 * GET /api/pdf/dd-external-dossier/[id]
 *
 * Externes Objektdossier (die „öffentliche" Version für Verkäufer/Makler).
 *
 * Strategie:
 *   1. Wenn `dd_projects.public_dossier_json` bereits gesetzt: direkt
 *      PDF rendern (Cache).
 *   2. Sonst: LLM-Pass mit externem-Dossier-Prompt, Ergebnis persistieren
 *      und dann rendern.
 *
 * Query `?regenerate=1` erzwingt Neu-Berechnung (z. B. wenn User
 * `extra_user_context` geändert hat).
 */

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { renderToStream } from "@react-pdf/renderer";
import { getActiveWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  DdExternalDossierDocument,
  type DdExternalDossierPdfData,
} from "@/components/pdf/DdExternalDossierDocument";
import { externalDossierSchema } from "@/lib/dd/schemas/external-dossier";
import {
  EXTERNAL_DOSSIER_SYSTEM_PROMPT,
  buildExternalDossierUserMessage,
} from "@/lib/dd/prompts/external-dossier";
import { callLlmJson, PROMPT_VERSION } from "@/lib/dd/llm";
import {
  isPropertyType,
  propertyTypeGuidance,
} from "@/lib/dd/property-type";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const active = await getActiveWorkspace();
  if (!active) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const forceRegenerate = url.searchParams.get("regenerate") === "1";

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("dd_projects")
    .select(
      "id, workspace_id, name, address_hint, property_type, extracted_expose, market_snapshot, public_dossier_json, paid, extra_user_context, analyzed_at"
    )
    .eq("id", id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return new Response("not found", { status: 404 });
  if (!project.paid) return new Response("payment_required", { status: 402 });

  let dossier = project.public_dossier_json as unknown;

  if (!dossier || forceRegenerate) {
    // Alle Extraktionen einsammeln — analog zur Consolidate-Route.
    const { data: docs } = await supabase
      .from("dd_documents")
      .select("kind, extraction, ocr_status")
      .eq("dd_project_id", id);

    const wegExtractions = (docs ?? [])
      .filter((d) => d.kind === "weg_minutes" && d.ocr_status === "extracted")
      .map((d) => d.extraction);
    const wpDoc = (docs ?? []).find(
      (d) => d.kind === "wirtschaftsplan" && d.ocr_status === "extracted"
    );
    const teilungDoc = (docs ?? []).find(
      (d) => d.kind === "teilungserklaerung" && d.ocr_status === "extracted"
    );
    const energieDoc = (docs ?? []).find(
      (d) => d.kind === "energieausweis" && d.ocr_status === "extracted"
    );

    const pType = isPropertyType(project.property_type)
      ? project.property_type
      : "etw_weg";
    const userMessage = buildExternalDossierUserMessage({
      extractedExpose: project.extracted_expose,
      extractedWeg: wegExtractions,
      extractedWirtschaftsplan: wpDoc?.extraction ?? null,
      extractedTeilung: teilungDoc?.extraction ?? null,
      extractedEnergie: energieDoc?.extraction ?? null,
      marketSnapshot: project.market_snapshot,
      propertyTypeGuidance: propertyTypeGuidance(pType),
      extraUserContext:
        typeof project.extra_user_context === "string" &&
        project.extra_user_context.trim().length > 0
          ? project.extra_user_context.trim()
          : null,
    });

    try {
      const result = await callLlmJson({
        model: "sonnet",
        purpose: "external_dossier",
        systemPrompt: EXTERNAL_DOSSIER_SYSTEM_PROMPT,
        userMessage,
        schema: externalDossierSchema,
        // Gleiche Falle wie bei der Konsolidierung: `assessments` mit
        // Details und Zitaten wird lang, `open_items` und
        // `market_context` stehen danach. 16000 ist die Obergrenze fuer
        // einen Non-Streaming-Request.
        maxTokens: 16000,
        temperature: 0,
        workspaceId: active.id,
        ddProjectId: id,
        supabase,
      });

      dossier = result.data;

      await supabase
        .from("dd_projects")
        .update({
          public_dossier_json: dossier,
          prompt_version: PROMPT_VERSION,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    } catch (err) {
      return new Response(
        `dossier_generation_failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 }
      );
    }
  }

  const parsed = externalDossierSchema.safeParse(dossier);
  if (!parsed.success) {
    return new Response("dossier_schema_invalid", { status: 500 });
  }

  const exp = (project.extracted_expose ?? {}) as {
    street?: string | null;
    postal_code?: string | null;
    city?: string | null;
    purchase_price_eur?: number | null;
    living_area_sqm?: number | null;
  };
  const addressLine =
    [exp.street, [exp.postal_code, exp.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || project.address_hint || "";

  const data: DdExternalDossierPdfData = {
    projectName: project.name,
    addressLine,
    purchasePriceEur: exp.purchase_price_eur ?? null,
    livingAreaSqm: exp.living_area_sqm ?? null,
    dossier: parsed.data,
    computedAt: project.analyzed_at ?? new Date().toISOString(),
  };

  const stream = await renderToStream(
    DdExternalDossierDocument({ data }) as never
  );
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="objektdossier-${id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
