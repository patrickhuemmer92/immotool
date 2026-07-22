import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NewDdProjectForm } from "./new-form";

export default async function NewDdProjectPage() {
  const t = await getTranslations();
  return (
    <div className="max-w-xl">
      <Link
        href="/analyse"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("dd.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("dd.new")}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t("dd.new_help")}
      </p>
      <div className="mt-6">
        <NewDdProjectForm />
      </div>
    </div>
  );
}
