import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations();
  const { next } = await searchParams;
  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("app.name")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t("auth.signup")}
        </p>
      </div>
      <SignupForm redirectTo={next ?? "/"} />
      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400 text-center">
        {t("auth.have_account")}{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-neutral-900 dark:text-neutral-100 underline-offset-2 hover:underline"
        >
          {t("auth.to_login")}
        </Link>
      </p>
    </div>
  );
}
