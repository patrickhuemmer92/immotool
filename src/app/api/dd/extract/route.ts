/**
 * POST /api/dd/extract
 * Body: { dd_project_id, document_id }
 *
 * Zieht das Dokument aus dem `dd-documents`-Storage-Bucket, extrahiert
 * den Text (PDF via unpdf), ruft das passende LLM-Prompt-Template auf
 * und schreibt das Ergebnis nach `dd_documents.extraction` sowie —
 * für Exposé — als extrahiertes Objekt auf `dd_projects.extracted_expose`.
 *
 * Läuft als `nodejs`-Runtime mit erhöhtem Timeout, weil LLM-Calls
 * mehrere Sekunden dauern können.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { extractPdfText } from "@/lib/dd/extract-pdf";
import { callLlmJson, PROMPT_VERSION } from "@/lib/dd/llm";
import { exposeExtractionSchema } from "@/lib/dd/schemas/expose";
import {
  EXPOSE_SYSTEM_PROMPT,
  buildExposeUserMessage,
} from "@/lib/dd/prompts/expose";

// Grober Größen-Cap: > 300k Zeichen (~75k Tokens) killen wir vorher, sonst
// wird der LLM-Call teuer und langsam. In Phase 3 chunken wir große
// WEG-Protokoll-Stacks; für v1 reicht ein harter Cap.
const MAX_TEXT_CHARS = 300_000;

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    dd_project_id?: string;
    document_id?: string;
  } | null;

  if (!body?.dd_project_id || !body.document_id) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const supabase = await createClient();

  // Workspace-Scoping via Parent-Projekt
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, workspace_id")
    .eq("id", body.dd_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }

  const { data: doc } = await supabase
    .from("dd_documents")
    .select("id, kind, storage_path, mime_type, ocr_status, file_hash")
    .eq("id", body.document_id)
    .eq("dd_project_id", body.dd_project_id)
    .maybeSingle();
  if (!doc) {
    return NextResponse.json({ error: "doc_not_found" }, { status: 404 });
  }

  // Idempotenz-Kurzschluss: wenn `ocr_status = extracted` und `file_hash`
  // gesetzt, nichts tun. Erneutes Anstoßen im Fehlerfall ist möglich,
  // indem ocr_status zurückgesetzt wird.
  if (doc.ocr_status === "extracted") {
    return NextResponse.json({ ok: true, cached: true });
  }

  // Datei aus Storage holen
  const { data: fileBlob, error: dlErr } = await supabase.storage
    .from("dd-documents")
    .download(doc.storage_path);
  if (dlErr || !fileBlob) {
    return NextResponse.json(
      { error: `download_failed: ${dlErr?.message ?? "no_blob"}` },
      { status: 500 }
    );
  }
  const arrayBuf = await fileBlob.arrayBuffer();

  // File-Hash für Cache/Audit
  const fileHash = createHash("sha256").update(Buffer.from(arrayBuf)).digest("hex");

  // Text extrahieren (v1: nur PDF)
  let text = "";
  let pages = 0;
  let scanned = false;
  if (doc.mime_type === "application/pdf") {
    const pdf = await extractPdfText(arrayBuf);
    text = pdf.text;
    pages = pdf.textPages;
    scanned = pdf.isProbablyScanned;
  } else {
    await supabase
      .from("dd_documents")
      .update({
        ocr_status: "not_needed",
        ocr_error: "MIME-Type wird in v1 nicht extrahiert",
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: "unsupported_mime" }, { status: 415 });
  }

  if (scanned || text.trim().length < 50) {
    await supabase
      .from("dd_documents")
      .update({
        ocr_status: "failed",
        ocr_error:
          "PDF enthält keinen extrahierbaren Text — vermutlich gescannt. OCR folgt in einer späteren Version.",
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json(
      { error: "probably_scanned_needs_ocr" },
      { status: 422 }
    );
  }

  const trimmedText =
    text.length > MAX_TEXT_CHARS
      ? text.slice(0, MAX_TEXT_CHARS) + "\n\n[…gekürzt…]"
      : text;

  // Dispatch je Dokument-Typ
  try {
    if (doc.kind === "expose") {
      const result = await callLlmJson({
        model: "sonnet",
        purpose: "extract_expose",
        systemPrompt: EXPOSE_SYSTEM_PROMPT,
        userMessage: buildExposeUserMessage(trimmedText),
        schema: exposeExtractionSchema,
        maxTokens: 4096,
        temperature: 0,
        workspaceId: active.id,
        ddProjectId: body.dd_project_id,
        supabase,
      });

      // Doku aktualisieren + Projekt-Level extracted_expose setzen
      await supabase
        .from("dd_documents")
        .update({
          ocr_status: "extracted",
          ocr_text_pages: pages,
          extraction: result.data,
          extracted_at: new Date().toISOString(),
          file_hash: fileHash,
        })
        .eq("id", doc.id);

      await supabase
        .from("dd_projects")
        .update({
          extracted_expose: result.data,
          model_version: result.model,
          prompt_version: PROMPT_VERSION,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.dd_project_id);

      return NextResponse.json({
        ok: true,
        kind: "expose",
        tokens: { in: result.tokensIn, out: result.tokensOut },
        cost_cents: result.costCents,
      });
    }

    // Phase 3: weitere Dokumenttypen (WEG etc.) — hier noch nicht.
    await supabase
      .from("dd_documents")
      .update({
        ocr_status: "extracted",
        ocr_text_pages: pages,
        extraction: { raw_text: trimmedText.slice(0, 5000) },
        extracted_at: new Date().toISOString(),
        file_hash: fileHash,
      })
      .eq("id", doc.id);

    return NextResponse.json({
      ok: true,
      kind: doc.kind,
      note: "extraction_pipeline_pending",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("dd_documents")
      .update({
        ocr_status: "failed",
        ocr_error: msg,
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

