import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit, isOwner } from "@/lib/workspace";
import { OwnerForm } from "../owner-form";
import { deleteOwner } from "../actions";

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
    .select("id, name, tax_id, notes")
    .eq("id", id)
    .maybeSingle();

  if (!owner) notFound();

  return (
    <div>
      <Link
        href="/eigentuemer"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("owners.title")}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{owner.name}</h1>
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
            name: owner.name,
            tax_id: owner.tax_id ?? "",
            notes: owner.notes ?? "",
          }}
          readOnly={!canEdit(active.role)}
        />
      </div>
    </div>
  );
}
