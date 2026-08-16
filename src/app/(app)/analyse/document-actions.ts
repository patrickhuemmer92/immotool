"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

export type DdDocState = { error?: string; documentId?: string } | undefined;

const DOCUMENT_KINDS = [
  "expose",
  "weg_minutes",
  "wirtschaftsplan",
  "teilungserklaerung",
  "energieausweis",
  "grundriss",
  "other",
] as const;

/**
 * Nach dem Client-Direct-Upload nach dem `dd-documents`-Bucket wird
 * diese Server-Action aufgerufen, damit wir eine Row in `dd_documents`
 * anlegen. Extraktion wird NICHT hier synchron gemacht — dafür ist
 * die API-Route `/api/dd/[projectId]/extract/[docId]` zuständig
 * (das kann mehrere Sekunden dauern).
 */
const insertSchema = z.object({
  dd_project_id: z.string().uuid(),
  kind: z.enum(DOCUMENT_KINDS),
  filename: z.string().min(1).max(500),
  storage_path: z.string().min(1).max(1000),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
});

export async function registerDdDocument(input: {
  dd_project_id: string;
  kind: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}): Promise<DdDocState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  const parsed = insertSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();

  // Absichern: Projekt gehört dem aktiven Workspace.
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, workspace_id")
    .eq("id", parsed.data.dd_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return { error: "project_not_found" };

  const { data, error } = await supabase
    .from("dd_documents")
    .insert({
      dd_project_id: parsed.data.dd_project_id,
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

  revalidatePath(`/analyse/${parsed.data.dd_project_id}`);
  return { documentId: data.id };
}

export async function deleteDdDocument(
  documentId: string,
  projectId: string
): Promise<void> {
  const active = await getActiveWorkspace();
  if (!active) return;

  const supabase = await createClient();

  // Storage-Pfad holen, um auch die Datei zu löschen.
  const { data: doc } = await supabase
    .from("dd_documents")
    .select(
      "storage_path, dd_projects!inner(workspace_id)"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return;
  // TypeScript kennt den `!inner`-Join nur als Array — trotzdem einfacher
  // Cast als Objekt, weil `maybeSingle` es zur Zeile flattet.
  const workspaceId = (
    doc as unknown as { dd_projects: { workspace_id: string } }
  ).dd_projects?.workspace_id;
  if (workspaceId !== active.id) return;

  await supabase.storage
    .from("dd-documents")
    .remove([(doc as unknown as { storage_path: string }).storage_path]);

  await supabase.from("dd_documents").delete().eq("id", documentId);

  revalidatePath(`/analyse/${projectId}`);
}
