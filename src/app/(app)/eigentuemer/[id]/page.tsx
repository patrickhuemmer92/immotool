import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit, isOwner } from "@/lib/workspace";
import { OwnerForm } from "../owner-form";
import { deleteOwner } from "../actions";
import { GroupMembersEditor } from "./group-members-editor";

export default async function OwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: owner } = await supabase
    .from("owners")
    .select("id, name, kind, first_name, last_name, notes")
    .eq("id", id)
    .maybeSingle();

  if (!owner) notFound();

  const isGroup = owner.kind === "group";
  const editable = canEdit(active.role);

  // For groups: existing members + list of person candidates (= all persons
  // in the workspace not already in this group).
  let members: { id: string; person_owner_id: string; name: string }[] = [];
  let availablePersons: { id: string; name: string }[] = [];
  if (isGroup) {
    const { data: rows } = await supabase
      .from("owner_members")
      .select("id, person_owner_id, person:owners!person_owner_id(name)")
      .eq("group_owner_id", id);
    members = (rows ?? []).map((r) => ({
      id: r.id,
      person_owner_id: r.person_owner_id,
      name:
        ((r.person as unknown) as { name: string } | null)?.name ?? "?",
    }));
    const memberIds = new Set(members.map((m) => m.person_owner_id));
    const { data: persons } = await supabase
      .from("owners")
      .select("id, name")
      .eq("workspace_id", active.id)
      .eq("kind", "person")
      .order("name");
    availablePersons = (persons ?? []).filter((p) => !memberIds.has(p.id));
  }

  return (
    <div>
      <Link
        href="/eigentuemer"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("owners.title")}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {owner.name}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {isGroup ? t("owners.kind_group") : t("owners.kind_person")}
          </p>
        </div>
        {isOwner(active.role) && (
          <form action={deleteOwner.bind(null, owner.id)}>
            <button
              type="submit"
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              {t("common.delete")}
            </button>
          </form>
        )}
      </div>

      <div className="mt-6">
        <OwnerForm
          ownerId={owner.id}
          defaults={{
            kind: (owner.kind as "person" | "group") ?? "person",
            first_name: owner.first_name ?? "",
            last_name: owner.last_name ?? "",
            name: owner.name,
            notes: owner.notes ?? "",
          }}
          readOnly={!editable}
        />
      </div>

      {isGroup && (
        <div className="mt-10 max-w-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("owners.members")}
          </h2>
          <GroupMembersEditor
            groupId={owner.id}
            members={members}
            availablePersons={availablePersons}
            readOnly={!editable}
          />
        </div>
      )}
    </div>
  );
}
