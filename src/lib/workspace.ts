import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface ActiveWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  ownerUserId: string;
}

const COOKIE = "active_workspace_id";

export async function listMemberships(): Promise<ActiveWorkspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, owner_user_id)")
    .eq("status", "accepted")
    .order("invited_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => {
    const w = row.workspaces as unknown as {
      id: string;
      name: string;
      owner_user_id: string;
    };
    return {
      id: w.id,
      name: w.name,
      role: row.role as WorkspaceRole,
      ownerUserId: w.owner_user_id,
    };
  });
}

export async function getActiveWorkspace(): Promise<ActiveWorkspace | null> {
  const memberships = await listMemberships();
  if (memberships.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(COOKIE)?.value;
  return (
    memberships.find((m) => m.id === wanted) ?? memberships[0] ?? null
  );
}

export async function setActiveWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, workspaceId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function canEdit(role: WorkspaceRole): boolean {
  return role === "owner" || role === "editor";
}

export function isOwner(role: WorkspaceRole): boolean {
  return role === "owner";
}
