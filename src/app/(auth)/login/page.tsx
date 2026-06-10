import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Wordmark } from "@/components/wordmark";

export default async function LoginPage({
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
        <p className="mt-4 text-sm text-neutral-500">{t("auth.login")}</p>
      </div>
      <LoginForm redirectTo={next ?? "/dashboard"} />
      <p className="mt-6 text-sm text-neutral-500 text-center">
        {t("auth.no_account")}{" "}
        <Link
          href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {t("auth.to_signup")}
        </Link>
      </p>
    </div>
  );
}
