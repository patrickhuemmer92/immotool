/**
 * GET /api/onboarding/status?onboarding_project_id=xxx
 *
 * Polling-Endpoint für den Extraktions-Fortschritt der Onboarding-
 * Dokumente. Wird vom Sticky-Job-Status-Widget alle 2s aufgerufen,
 * solange Uploads pending sind. Analog zu /api/dd/status.
 *
 * Timeout-Reklamation: pending-Docs älter als 4 Min werden auf
 * 'failed' gesetzt, damit der User nicht ewig auf einem Spinner
 * hängen bleibt.
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
  const projectId = url.searchParams.get("onboarding_project_id");
  if (!projectId)
    return NextResponse.json({ error: "missing_project" }, { status: 400 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, workspace_id, status, created_property_id")
    .eq("id", projectId)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: docs } = await supabase
    .from("onboarding_documents")
    .select(
      "id, kind, filename, ocr_status, ocr_error, extracted_at, uploaded_at"
    )
    .eq("onboarding_project_id", projectId)
    .order("uploaded_at", { ascending: false });

  // Timeout-Reklamation für hängengebliebene pending-Docs (>4 min)
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
      `[onb-status] reclaiming ${stuck.length} stuck pending doc(s) ` +
        `project=${projectId.slice(0, 8)}`
    );
    for (const s of stuck) {
      await supabase
        .from("onboarding_documents")
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
        "Extraktion hat länger als 4 Minuten gebraucht — Server-Timeout.";
    }
  }

  return NextResponse.json({
    project: {
      status: project.status,
      created_property_id: project.created_property_id,
    },
    documents: docs ?? [],
  });
}
