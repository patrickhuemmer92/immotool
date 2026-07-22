import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDdProject } from "@/lib/dd/projects";

export default async function DdProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const project = await getDdProject(supabase, active.id, id);
  if (!project) notFound();

  return (
    <div>
      <Link
        href="/analyse"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("dd.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {project.name}
      </h1>
      {project.address_hint && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {project.address_hint}
        </p>
      )}
      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("dd.detail_placeholder")}
        </p>
      </div>

      {/* Sichtbarer Disclaimer — auch schon im Placeholder, damit User
          von Anfang an sieht, dass das keine Rechts-/Finanzberatung ist. */}
      <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
        <strong className="font-semibold">{t("dd.disclaimer_title")}:</strong>{" "}
        {t("dd.disclaimer_body")}
      </div>
    </div>
  );
}
