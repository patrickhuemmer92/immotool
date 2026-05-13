import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { ResetRequestForm } from "./reset-request-form";

export default async function ForgotPasswordPage() {
  const t = await getTranslations();
  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <Wordmark size="lg" tagline />
        <p className="mt-4 text-sm text-neutral-500">{t("auth.reset_title")}</p>
      </div>
      <ResetRequestForm />
      <p className="mt-6 text-sm text-neutral-500 text-center">
        <Link
          href="/login"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          ← {t("auth.to_login")}
        </Link>
      </p>
    </div>
  );
}
