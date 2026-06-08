import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SignupForm } from "./signup-form";
import { Wordmark } from "@/components/wordmark";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations();
  const { next } = await searchParams;
  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <Wordmark size="lg" tagline />
        <p className="mt-4 text-sm text-neutral-500">{t("auth.signup")}</p>
      </div>
      <SignupForm redirectTo={next ?? "/dashboard"} />
      <p className="mt-6 text-sm text-neutral-500 text-center">
        {t("auth.have_account")}{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {t("auth.to_login")}
        </Link>
      </p>
    </div>
  );
}
