/**
 * POST /api/dd/analyze
 * Body: { dd_project_id }
 *
 * Sammelt alle Extraktionen des Projekts, ruft den Konsolidierungs-Prompt
 * mit strukturierten Daten (nicht Rohtext), speichert Findings, Fragen,
 * Verhandlungsargumente. Berechnet den regelbasierten Score.
 *
 * Voraussetzung: mindestens ein extrahiertes Exposé.
 */

export const runtime = "nodejs";
// 300s — Konsolidierung mehrerer großer Extractions (Exposé + WEG-
// Protokolle + Wirtschaftsplan) kann leicht 60s übersteigen. Vercel
// Pro erlaubt bis 300s pro Function.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { callLlmJson, PROMPT_VERSION } from "@/lib/dd/llm";
import { formatNotesForPrompt, type DdProjectNote } from "@/lib/dd/notes";
import { consolidationResultSchema } from "@/lib/dd/schemas/findings";
import {
  CONSOLIDATION_SYSTEM_PROMPT,
  buildConsolidationUserMessage,
} from "@/lib/dd/prompts/consolidate";
import { computeScore } from "@/lib/dd/scoring";
import {
  isPropertyType,
  propertyTypeGuidance,
} from "@/lib/dd/property-type";

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { dd_project_id?: string } | null;
  if (!body?.dd_project_id) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, workspace_id, property_type, extracted_expose, market_snapshot, paid, extra_user_context")
    .eq("id", body.dd_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  if (!project.paid) {
    return NextResponse.json({ error: "payment_required" }, { status: 402 });
  }

  if (!project.extracted_expose) {
    return NextResponse.json({ error: "expose_missing" }, { status: 400 });
  }

  const { data: docs } = await supabase
    .from("dd_documents")
    .select("id, kind, extraction, ocr_status")
    .eq("dd_project_id", body.dd_project_id);

  const wegExtractions =
    (docs ?? [])
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
  // Gespraechsnotizen (Migration 0032) — chronologisch fuer den Prompt.
  const { data: noteRows } = await supabase
    .from("dd_project_notes")
    .select("id, occurred_on, source, note, created_at")
    .eq("dd_project_id", body.dd_project_id);
  const notesBlock = formatNotesForPrompt((noteRows ?? []) as DdProjectNote[]);

  const userMessage = buildConsolidationUserMessage({
    extractedExpose: project.extracted_expose,
    extractedWeg: wegExtractions,
    extractedWirtschaftsplan: wpDoc?.extraction ?? null,
    extractedTeilung: teilungDoc?.extraction ?? null,
    extractedEnergie: energieDoc?.extraction ?? null,
    marketSnapshot: project.market_snapshot,
    propertyTypeGuidance: propertyTypeGuidance(pType),
    notesBlock,
  });

  let result;
  try {
    result = await callLlmJson({
      model: "sonnet",
      purpose: "consolidate_findings",
      systemPrompt: CONSOLIDATION_SYSTEM_PROMPT,
      userMessage,
      schema: consolidationResultSchema,
      // Dritter Anlauf beim Limit: 4096 schnitt mitten in der
      // Findings-Liste ab, 8192 kam bis zum Ende der Findings und liess
      // dann `questions` und `negotiation_arguments` weg — also exakt
      // die beiden letzten Felder des Schemas.
      //
      // Achtung, der alte Kommentar hier war irrefuehrend: dieser Call
      // streamt NICHT (client.messages.create), und maxDuration hilft
      // gegen ein Token-Limit ohnehin nicht. 16000 ist die Grenze, bis
      // zu der ein Non-Streaming-Request unkritisch ist; darueber
      // muesste auf Streaming umgestellt werden.
      maxTokens: 16000,
      temperature: 0,
      workspaceId: active.id,
      ddProjectId: body.dd_project_id,
      supabase,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Findings persistieren — vorher alte Findings dieses Projekts löschen
  // (Neu-Berechnung = Neu-Speichern, keine Historie in v1).
  await supabase.from("dd_findings").delete().eq("dd_project_id", body.dd_project_id);

  const findingRows = result.data.findings.map((f) => ({
    dd_project_id: body.dd_project_id!,
    category: f.category,
    severity: f.severity,
    title: f.title,
    description: f.description,
    cost_min: f.cost_min_eur != null ? Math.round(f.cost_min_eur * 100) : null,
    cost_max: f.cost_max_eur != null ? Math.round(f.cost_max_eur * 100) : null,
    cost_horizon: f.cost_horizon,
    source_document_id:
      f.source_kind !== "market" && f.source_kind !== "computed"
        ? // Wir speichern hier keinen echten FK — der ist optional. Der
          // LLM-Output referenziert das Dokument via source_kind (Typ),
          // was für die UI reicht.
          null
        : null,
    source_quote: f.source_quote,
    source_location: f.source_location,
    source_market: f.source_kind === "market" ? "consolidation" : null,
    confidence: f.confidence,
    confidence_reason: f.confidence_reason,
    next_step: f.next_step,
  }));

  if (findingRows.length > 0) {
    const { error: findingsErr } = await supabase.from("dd_findings").insert(findingRows);
    if (findingsErr) {
      return NextResponse.json(
        { error: `findings_insert_failed: ${findingsErr.message}` },
        { status: 500 }
      );
    }
  }

  // Score berechnen — regelbasiert
  const score = computeScore(result.data.findings, {
    hasExpose: !!project.extracted_expose,
    hasWeg: wegExtractions.length > 0,
    hasWirtschaftsplan: !!wpDoc,
    hasTeilung: !!teilungDoc,
    hasEnergie: !!energieDoc,
  });

  // Project-Update: Score + Konsolidierungs-Blobs (für Fragen/Argumente
  // brauchen wir einen Platz — v1 legen wir sie neben Score als JSONB ab).
  await supabase
    .from("dd_projects")
    .update({
      status: "analyzed",
      score_overall: score.overall,
      score_confidence: score.confidence,
      score_by_category: score.by_category,
      market_snapshot: project.market_snapshot ?? null,
      model_version: result.model,
      prompt_version: PROMPT_VERSION,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Fragen + Argumente in extracted_expose würden das Feld überschreiben —
      // deshalb hängen wir sie an ein Meta-Objekt an.
    })
    .eq("id", body.dd_project_id);

  // Fragen + Argumente in einer separaten Struktur — wir nutzen dafür ein
  // neues Feld im JSONB `score_by_category` als Meta-Bucket (ohne extra
  // Migration). Kompromiss für v1; sauber wäre eine eigene Tabelle.
  await supabase
    .from("dd_projects")
    .update({
      score_by_category: {
        ...score.by_category,
        _meta: {
          questions: result.data.questions,
          negotiation_arguments: result.data.negotiation_arguments,
        },
      },
    })
    .eq("id", body.dd_project_id);

  return NextResponse.json({
    ok: true,
    findings_count: findingRows.length,
    score,
    tokens: { in: result.tokensIn, out: result.tokensOut },
    cost_cents: result.costCents,
  });
}
