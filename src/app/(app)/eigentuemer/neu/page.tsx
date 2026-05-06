import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { OwnerForm } from "../owner-form";

export default async function NewOwnerPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!canEdit(active.role)) redirect("/eigentuemer");

  return (
    <div>
      <Link
        href="/eigentuemer"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("owners.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("owners.new")}
      </h1>

      <div className="mt-6">
        <OwnerForm
          defaults={{ name: "", tax_id: "", notes: "" }}
          readOnly={false}
        />
      </div>
    </div>
  );
}
