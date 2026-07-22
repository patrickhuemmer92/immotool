/**
 * Data-Access-Helpers für DD-Projekte. Kapselt die Standard-Queries mit
 * Workspace-Scoping, damit UI-Code nicht überall `workspace_id` filtert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DdProjectStatus =
  | "draft"
  | "analyzed"
  | "watchlist"
  | "promoted"
  | "archived";

export type DdProject = {
  id: string;
  workspace_id: string;
  name: string;
  address_hint: string | null;
  status: DdProjectStatus;
  promoted_to_property_id: string | null;
  paid: boolean;
  paid_at: string | null;
  extracted_expose: unknown | null;
  market_snapshot: unknown | null;
  score_overall: number | null;
  score_confidence: number | null;
  score_by_category: unknown | null;
  model_version: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
};

export async function listDdProjects(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<DdProject[]> {
  const { data } = await supabase
    .from("due_diligence_projects")
    .select(
      "id, workspace_id, name, address_hint, status, promoted_to_property_id, paid, paid_at, score_overall, score_confidence, created_at, updated_at, analyzed_at"
    )
    .eq("workspace_id", workspaceId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  return (data ?? []) as DdProject[];
}

export async function getDdProject(
  supabase: SupabaseClient,
  workspaceId: string,
  id: string
): Promise<DdProject | null> {
  const { data } = await supabase
    .from("due_diligence_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return (data as DdProject | null) ?? null;
}
