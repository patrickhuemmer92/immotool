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
    .select("id, kind, filename, ocr_status, ocr_error, extracted_at")
    .eq("dd_project_id", projectId)
    .order("uploaded_at", { ascending: false });

  return NextResponse.json({
    project: {
      analyzed: project.score_overall != null,
      analyzed_at: project.analyzed_at,
      paid: project.paid,
    },
    documents: docs ?? [],
  });
}
