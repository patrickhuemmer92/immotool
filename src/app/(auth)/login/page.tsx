import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations();
  const { next } = await searchParams;
  return (
    <AuthCard title={t("app.name")} subtitle={t("auth.login")}>
      <LoginForm redirectTo={next ?? "/"} />
      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400 text-center">
        {t("auth.no_account")}{" "}
        <Link
          href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-neutral-900 dark:text-neutral-100 underline-offset-2 hover:underline"
        >
          {t("auth.to_signup")}
        </Link>
      </p>
    </AuthCard>
  );
}

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}
