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
// 300s: WEG-Protokolle mit 30+ Seiten im Vision-Modus können 60-120s
// dauern. Puffer für Retry bei ungültigem JSON.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { extractPdfText } from "@/lib/dd/extract-pdf";
import { callLlmJson, PROMPT_VERSION } from "@/lib/dd/llm";
import { exposeExtractionSchema } from "@/lib/dd/schemas/expose";
import { wegExtractionSchema } from "@/lib/dd/schemas/weg";
import { wirtschaftsplanExtractionSchema } from "@/lib/dd/schemas/wirtschaftsplan";
import {
  teilungExtractionSchema,
  energieExtractionSchema,
} from "@/lib/dd/schemas/teilung-und-energie";
import {
  EXPOSE_SYSTEM_PROMPT,
  buildExposeUserMessage,
} from "@/lib/dd/prompts/expose";
import {
  WEG_SYSTEM_PROMPT,
  buildWegUserMessage,
  WIRTSCHAFTSPLAN_SYSTEM_PROMPT,
  buildWirtschaftsplanUserMessage,
  TEILUNG_SYSTEM_PROMPT,
  buildTeilungUserMessage,
  ENERGIE_SYSTEM_PROMPT,
  buildEnergieUserMessage,
} from "@/lib/dd/prompts/documents";

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

  console.log(
    `[dd-extract] enter dd=${body.dd_project_id.slice(0, 8)} doc=${body.document_id.slice(0, 8)}`
  );

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
  // WICHTIG: pdfjs-dist (via unpdf) übernimmt den Buffer als
  // "Transferable Object" — der übergebene Uint8Array wird DETACHED,
  // sobald unpdf die Worker-Loading-Task startet. Wir brauchen die
  // Bytes aber später NOCH für den Vision-Modus (base64-Encoding an
  // Anthropic). Deshalb: ZWEI unabhängige Kopien via arrayBuf.slice().
  const bytesForPdfExtract = new Uint8Array(arrayBuf.slice(0));
  const bytesForVision = new Uint8Array(arrayBuf.slice(0));

  // File-Hash für Cache/Audit
  const fileHash = createHash("sha256").update(bytesForVision).digest("hex");

  // Text extrahieren (v1: nur PDF)
  let text = "";
  let pages = 0;
  let totalPages = 0;
  let scanned = false;
  if (doc.mime_type === "application/pdf") {
    // bytesForPdfExtract wird von unpdf detached — Kopie ist absichtlich
    const pdf = await extractPdfText(bytesForPdfExtract);
    text = pdf.text;
    pages = pdf.textPages;
    totalPages = pdf.totalPages;
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

  // Extraktions-Strategie:
  //   - Text-PDF mit ausreichend Inhalt → billiger Text-Modus
  //   - Sonst (gescannt) → Vision-Modus: PDF direkt an Anthropic senden.
  //     Anthropic hat nativen PDF-Support (Text UND Bild) — kein
  //     separater OCR-Layer nötig.
  const useVision = scanned || text.trim().length < 50;
  const pdfBufferForVision = useVision ? bytesForVision : undefined;

  // Hard-Cap: bei > 25 Seiten überschreitet die Vision-Extraktion die
  // Vercel-Function-maxDuration. Klar failen statt User 4 Minuten warten
  // zu lassen. WEG-Protokolle mit vielen Anhängen sind hier oft dran —
  // Empfehlung: splitten, nur die Sitzungsteile hochladen.
  if (useVision && totalPages > 25) {
    const msg =
      `Dokument hat ${totalPages} Seiten — zu groß für automatische Analyse. ` +
      `Bei WEG-Protokollen reichen meist die Sitzungsteile (ohne Anhänge). ` +
      `Bitte PDF splitten und nur die relevanten Seiten erneut hochladen.`;
    await supabase
      .from("dd_documents")
      .update({
        ocr_status: "failed",
        ocr_error: msg,
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: msg }, { status: 413 });
  }

  // Sanity-Cap: Anthropic akzeptiert PDFs bis 32 MB / 100 Seiten. Wenn
  // hier drüber, brechen wir ab — Chunking kommt später.
  if (useVision && bytesForVision.byteLength > 32 * 1024 * 1024) {
    await supabase
      .from("dd_documents")
      .update({
        ocr_status: "failed",
        ocr_error:
          "PDF größer als 32 MB. Bitte kleiner splitten (nur die relevanten Seiten hochladen).",
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    return NextResponse.json({ error: "pdf_too_large" }, { status: 413 });
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
        purpose: useVision ? "extract_expose_vision" : "extract_expose",
        systemPrompt: EXPOSE_SYSTEM_PROMPT,
        userMessage: useVision
          ? buildExposeUserMessage(
              "[PDF wird direkt vom Modell gelesen — extrahiere die Felder aus dem angehängten Dokument.]"
            )
          : buildExposeUserMessage(trimmedText),
        pdfBuffer: pdfBufferForVision,
        schema: exposeExtractionSchema,
        maxTokens: 4096,
        temperature: 0,
        workspaceId: active.id,
        ddProjectId: body.dd_project_id,
        supabase,
      });

      // Doku aktualisieren + Projekt-Level extracted_expose setzen.
      // ocr_error explizit auf null zurücksetzen — bei einem Retry
      // eines vorher gescheiterten Docs würde sonst der alte Fehler
      // stehen bleiben, obwohl der Extract jetzt erfolgreich war.
      await supabase
        .from("dd_documents")
        .update({
          ocr_status: "extracted",
          ocr_text_pages: pages,
          extraction: result.data,
          extracted_at: new Date().toISOString(),
          file_hash: fileHash,
          ocr_error: null,
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

    // Dispatch für die weiteren Dokumenttypen — gleiches Schema wie
    // Exposé, nur mit typspezifischem Prompt und Zod-Schema.
    let systemPrompt = "";
    let userMessage = "";
    let schema: Parameters<typeof callLlmJson>[0]["schema"] | null = null;
    let purpose = "";

    switch (doc.kind) {
      case "weg_minutes":
        systemPrompt = WEG_SYSTEM_PROMPT;
        userMessage = buildWegUserMessage(trimmedText);
        schema = wegExtractionSchema;
        purpose = "extract_weg";
        break;
      case "wirtschaftsplan":
        systemPrompt = WIRTSCHAFTSPLAN_SYSTEM_PROMPT;
        userMessage = buildWirtschaftsplanUserMessage(trimmedText);
        schema = wirtschaftsplanExtractionSchema;
        purpose = "extract_wirtschaftsplan";
        break;
      case "teilungserklaerung":
        systemPrompt = TEILUNG_SYSTEM_PROMPT;
        userMessage = buildTeilungUserMessage(trimmedText);
        schema = teilungExtractionSchema;
        purpose = "extract_teilung";
        break;
      case "energieausweis":
        systemPrompt = ENERGIE_SYSTEM_PROMPT;
        userMessage = buildEnergieUserMessage(trimmedText);
        schema = energieExtractionSchema;
        purpose = "extract_energie";
        break;
      default:
        // grundriss / other: nur Rohtext speichern, keine LLM-Analyse
        await supabase
          .from("dd_documents")
          .update({
            ocr_status: "extracted",
            ocr_text_pages: pages,
            extraction: { raw_text: trimmedText.slice(0, 5000) },
            extracted_at: new Date().toISOString(),
            file_hash: fileHash,
            ocr_error: null,
          })
          .eq("id", doc.id);
        return NextResponse.json({ ok: true, kind: doc.kind });
    }

    const result = await callLlmJson({
      model: "sonnet",
      purpose: useVision ? `${purpose}_vision` : purpose,
      systemPrompt,
      // Bei Vision: User-Message ist nur Instruktion, PDF ist im
      // document-Block — sonst Textinhalt wie bisher.
      userMessage: useVision
        ? `[Das PDF wird direkt vom Modell gelesen — extrahiere die Felder aus dem angehängten Dokument in das folgende JSON-Format.]

${userMessage.split("Format:")[1] ?? userMessage}`
        : userMessage,
      pdfBuffer: pdfBufferForVision,
      schema,
      maxTokens: 4096,
      temperature: 0,
      workspaceId: active.id,
      ddProjectId: body.dd_project_id,
      supabase,
    });

    console.log(
      `[dd-extract] persist ok kind=${doc.kind} doc=${doc.id.slice(0, 8)}`
    );
    const { error: upErr } = await supabase
      .from("dd_documents")
      .update({
        ocr_status: "extracted",
        ocr_text_pages: pages,
        extraction: result.data,
        extracted_at: new Date().toISOString(),
        file_hash: fileHash,
        ocr_error: null,
      })
      .eq("id", doc.id);

    if (upErr) {
      console.error(
        `[dd-extract] DB-UPDATE FAILED doc=${doc.id.slice(0, 8)} err=${upErr.message}`
      );
      // Wenn wir hier den DB-Update-Fehler nicht sichtbar machen,
      // bleibt der Job für immer auf pending. Wir bringen ihn deshalb
      // aktiv auf 'failed', damit der User im Widget sieht dass was
      // schiefging.
      await supabase
        .from("dd_documents")
        .update({
          ocr_status: "failed",
          ocr_error: "DB-Update fehlgeschlagen: " + upErr.message,
          file_hash: fileHash,
        })
        .eq("id", doc.id);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    console.log(
      `[dd-extract] SUCCESS kind=${doc.kind} doc=${doc.id.slice(0, 8)}`
    );

    return NextResponse.json({
      ok: true,
      kind: doc.kind,
      tokens: { in: result.tokensIn, out: result.tokensOut },
      cost_cents: result.costCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[dd-extract] CAUGHT err msg="${msg.slice(0, 200)}"`
    );
    // Doku aktiv auf failed setzen — Widget zeigt dann den Fehler.
    const { error: failErr } = await supabase
      .from("dd_documents")
      .update({
        ocr_status: "failed",
        ocr_error: msg,
        file_hash: fileHash,
      })
      .eq("id", doc.id);
    if (failErr) {
      console.error(
        `[dd-extract] FAIL-UPDATE ALSO FAILED doc=${doc.id.slice(0, 8)} err=${failErr.message}`
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

