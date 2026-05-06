import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { MembersClient } from "./members-client";

type MemberRow = {
  id: string;
  invited_email: string;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "accepted" | "revoked";
  invited_at: string;
  invite_token: string | null;
};

export default async function MembersPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, invited_email, role, status, invited_at, invite_token")
    .eq("workspace_id", active.id)
    .order("invited_at", { ascending: false });

  return (
    <MembersClient
      members={(members ?? []) as MemberRow[]}
      isOwner={active.role === "owner"}
      labels={{
        invite: t("settings.members_invite"),
        email: t("settings.members_email"),
        role: t("settings.members_role"),
        status: t("settings.members_status"),
        invited_at: t("settings.members_invited_at"),
        revoke: t("settings.members_revoke"),
        invite_link: t("settings.members_invite_link"),
        copy_link: t("settings.members_copy_link"),
        link_copied: t("settings.members_link_copied"),
        actions: t("common.actions"),
        empty: t("common.empty"),
        role_owner: t("settings.role_owner"),
        role_editor: t("settings.role_editor"),
        role_viewer: t("settings.role_viewer"),
        status_pending: t("settings.status_pending"),
        status_accepted: t("settings.status_accepted"),
        status_revoked: t("settings.status_revoked"),
      }}
    />
  );
}
