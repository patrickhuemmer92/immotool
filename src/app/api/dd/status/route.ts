/**
 * GET /api/dd/status?dd_project_id=xxx
 *
 * Leichtgewichtiges Polling-Endpoint für den Extraktions-Fortschritt.
 * Gibt für jedes Dokument den aktuellen ocr_status + fehler zurück,
 * dazu einen Analyse-Status auf Project-Ebene.
 *
 * Genutzt von den Job-Status-Widgets im Frontend während lange
 * LLM-Calls laufen.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const active = await getActiveWorkspace();
  if (!active)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("dd_project_id");
  if (!projectId)
    return NextResponse.json({ error: "missing_project" }, { status: 400 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, workspace_id, score_overall, analyzed_at, paid")
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: docs } = await supabase
    .from("dd_documents")
    .select(
      "id, kind, filename, ocr_status, ocr_error, extracted_at, uploaded_at"
    )
    .eq("dd_project_id", projectId)
    .order("uploaded_at", { ascending: false });

  // Timeout-Reklamation: wenn ein Doku länger als 4 Minuten auf
  // 'pending' hängt, hat vermutlich die Extract-Function die
  // Vercel-maxDuration von 60s getroffen und ist abgeschossen worden,
  // oder der LLM-Client hat einen Deadlock. Wir markieren es aktiv als
  // 'failed', damit der User im Widget nicht ewig einen Spinner sieht.
  const STUCK_MS = 4 * 60 * 1000;
  const now = Date.now();
  const stuck = (docs ?? []).filter(
    (d) =>
      d.ocr_status === "pending" &&
      d.uploaded_at &&
      now - new Date(d.uploaded_at).getTime() > STUCK_MS
  );
  if (stuck.length > 0) {
    console.warn(
      `[dd-status] reclaiming ${stuck.length} stuck pending doc(s) ` +
        `project=${projectId.slice(0, 8)}`
    );
    for (const s of stuck) {
      await supabase
        .from("dd_documents")
        .update({
          ocr_status: "failed",
          ocr_error:
            "Extraktion hat länger als 4 Minuten gebraucht — Server-Timeout. " +
            "Bitte Dokument löschen und erneut hochladen. Falls es wieder klemmt: " +
            "PDF kleiner splitten oder als Nur-Text-PDF exportieren.",
        })
        .eq("id", s.id);
      s.ocr_status = "failed";
      s.ocr_error =
        "Extraktion hat länger als 4 Minuten gebraucht — Server-Timeout. " +
        "Bitte Dokument löschen und erneut hochladen.";
    }
  }

  return NextResponse.json({
    project: {
      analyzed: project.score_overall != null,
      analyzed_at: project.analyzed_at,
      paid: project.paid,
    },
    documents: docs ?? [],
  });
}
