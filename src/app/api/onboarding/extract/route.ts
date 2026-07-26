/**
 * POST /api/onboarding/extract
 * Body: { onboarding_project_id, document_id }
 *
 * Extraktions-Pipeline für die Onboarding-Vertragstypen. Struktur analog
 * /api/dd/extract: Download → PDF-Text mit Vision-Fallback → Dispatch je
 * Doku-Typ → Zod-validiertes JSON → Persist auf onboarding_documents
 * UND Aggregation auf onboarding_projects.extracted_summary.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { extractPdfText } from "@/lib/dd/extract-pdf";
import { callLlmJson, PROMPT_VERSION } from "@/lib/dd/llm";
import {
  kaufvertragSchema,
  mietvertragSchema,
  darlehensvertragSchema,
} from "@/lib/dd/schemas/onboarding";
import {
  KAUFVERTRAG_SYSTEM_PROMPT,
  buildKaufvertragUserMessage,
  MIETVERTRAG_SYSTEM_PROMPT,
  buildMietvertragUserMessage,
  DARLEHENSVERTRAG_SYSTEM_PROMPT,
  buildDarlehensvertragUserMessage,
} from "@/lib/dd/prompts/onboarding";

const MAX_TEXT_CHARS = 300_000;

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    onboarding_project_id?: string;
    document_id?: string;
  } | null;
  if (!body?.onboarding_project_id || !body.document_id) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  console.log(
    `[onb-extract] enter onb=${body.onboarding_project_id.slice(0, 8)} doc=${body.document_id.slice(0, 8)}`
  );

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, workspace_id, extracted_summary")
    .eq("id", body.onboarding_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project)
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  const { data: doc } = await supabase
    .from("onboarding_documents")
    .select("id, kind, storage_path, mime_type, ocr_status")
    .eq("id", body.document_id)
    .eq("onboarding_project_id", body.onboarding_project_id)
    .maybeSingle();
  if (!doc)
    return NextResponse.json({ error: "doc_not_found" }, { status: 404 });

  if (doc.ocr_status === "extracted") {
    return NextResponse.json({ ok: true, cached: true });
  }

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
  // WICHTIG: pdfjs-dist (via unpdf) übernimmt den Buffer als
  // Transferable Object — der übergebene Uint8Array wird DETACHED,
  // sobald unpdf die Worker-Loading-Task startet. Wir brauchen die
  // Bytes aber später NOCH für den Vision-Modus. Deshalb: zwei
  // unabhängige Kopien via arrayBuf.slice().
  const bytesForPdfExtract = new Uint8Array(arrayBuf.slice(0));
  const bytesForVision = new Uint8Array(arrayBuf.slice(0));
  const fileHash = createHash("sha256").update(bytesForVision).digest("hex");

  let text = "";
  let pages = 0;
  let scanned = false;
  if (doc.mime_type === "application/pdf") {
    const pdf = await extractPdfText(bytesForPdfExtract);
    text = pdf.text;
    pages = pdf.textPages;
    scanned = pdf.isProbablyScanned;
  } else {
    await supabase
      .from("onboarding_documents")
      .update({
        ocr_status: "not_needed",
        ocr_error: "MIME-Type wird in v1 nicht extrahiert",
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: "unsupported_mime" }, { status: 415 });
  }

  const useVision = scanned || text.trim().length < 50;
  const pdfBufferForVision = useVision ? bytesForVision : undefined;

  if (useVision && bytesForVision.byteLength > 32 * 1024 * 1024) {
    await supabase
      .from("onboarding_documents")
      .update({
        ocr_status: "failed",
        ocr_error: "PDF größer als 32 MB — bitte splitten.",
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: "pdf_too_large" }, { status: 413 });
  }

  const trimmedText =
    text.length > MAX_TEXT_CHARS
      ? text.slice(0, MAX_TEXT_CHARS) + "\n\n[…gekürzt…]"
      : text;

  // Dispatch je Vertragstyp
  let systemPrompt = "";
  let userMessage = "";
  let schema: Parameters<typeof callLlmJson>[0]["schema"] | null = null;
  let purpose = "";
  let summaryKey: "kauf" | "miete" | "darlehen" | null = null;

  switch (doc.kind) {
    case "kaufvertrag":
      systemPrompt = KAUFVERTRAG_SYSTEM_PROMPT;
      userMessage = buildKaufvertragUserMessage(trimmedText);
      schema = kaufvertragSchema;
      purpose = "extract_kaufvertrag";
      summaryKey = "kauf";
      break;
    case "mietvertrag":
      systemPrompt = MIETVERTRAG_SYSTEM_PROMPT;
      userMessage = buildMietvertragUserMessage(trimmedText);
      schema = mietvertragSchema;
      purpose = "extract_mietvertrag";
      summaryKey = "miete";
      break;
    case "darlehensvertrag":
      systemPrompt = DARLEHENSVERTRAG_SYSTEM_PROMPT;
      userMessage = buildDarlehensvertragUserMessage(trimmedText);
      schema = darlehensvertragSchema;
      purpose = "extract_darlehensvertrag";
      summaryKey = "darlehen";
      break;
    default:
      // grundbuchauszug / other — nur Rohtext ablegen, keine LLM-Analyse
      await supabase
        .from("onboarding_documents")
        .update({
          ocr_status: "extracted",
          ocr_text_pages: pages,
          extraction: { raw_text: trimmedText.slice(0, 5000) },
          extracted_at: new Date().toISOString(),
          file_hash: fileHash,
        })
        .eq("id", doc.id);
      return NextResponse.json({ ok: true, kind: doc.kind });
  }

  try {
    const result = await callLlmJson({
      model: "sonnet",
      purpose: useVision ? `${purpose}_vision` : purpose,
      systemPrompt,
      userMessage: useVision
        ? `[Das PDF wird direkt vom Modell gelesen — extrahiere die Felder aus dem angehängten Dokument in das folgende JSON-Format.]

${userMessage.split("Format:")[1] ?? userMessage}`
        : userMessage,
      pdfBuffer: pdfBufferForVision,
      schema,
      maxTokens: 4096,
      temperature: 0,
      workspaceId: active.id,
      supabase,
    });

    await supabase
      .from("onboarding_documents")
      .update({
        ocr_status: "extracted",
        ocr_text_pages: pages,
        extraction: result.data,
        extracted_at: new Date().toISOString(),
        file_hash: fileHash,
      })
      .eq("id", doc.id);

    // Aggregieren in onboarding_projects.extracted_summary.
    // Kauf: einer, Miete/Darlehen: Array (mehrere Verträge möglich).
    const current = (project.extracted_summary ?? {}) as {
      kauf?: unknown;
      miete?: unknown[];
      darlehen?: unknown[];
    };
    let merged: Record<string, unknown> = { ...current };
    if (summaryKey === "kauf") {
      merged = { ...merged, kauf: result.data };
    } else if (summaryKey === "miete") {
      merged = {
        ...merged,
        miete: [...(current.miete ?? []), result.data],
      };
    } else if (summaryKey === "darlehen") {
      merged = {
        ...merged,
        darlehen: [...(current.darlehen ?? []), result.data],
      };
    }

    await supabase
      .from("onboarding_projects")
      .update({
        status: "extracted",
        extracted_summary: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.onboarding_project_id);

    return NextResponse.json({
      ok: true,
      kind: doc.kind,
      tokens: { in: result.tokensIn, out: result.tokensOut },
      cost_cents: result.costCents,
      prompt_version: PROMPT_VERSION,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("onboarding_documents")
      .update({
        ocr_status: "failed",
        ocr_error: msg,
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
