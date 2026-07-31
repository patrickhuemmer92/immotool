import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NewOnboardingForm } from "./new-form";

export default async function NewOnboardingPage() {
  const t = await getTranslations();
  return (
    <div className="max-w-xl">
      <Link
        href="/onboarding"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("onb.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("onb.new")}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t("onb.new_help")}
      </p>
      <div className="mt-6">
        <NewOnboardingForm />
      </div>
    </div>
  );
}
