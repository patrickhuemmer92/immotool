import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("settings.title")}
      </h1>

      <nav className="mt-6 flex gap-1 text-sm border-b border-neutral-200 dark:border-neutral-800">
        <TabLink href="/einstellungen">{t("settings.general")}</TabLink>
        <TabLink href="/einstellungen/workspace">
          {t("settings.workspace")}
        </TabLink>
        <TabLink href="/einstellungen/mitglieder">
          {t("settings.members")}
        </TabLink>
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}

function TabLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 -mb-px border-b-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700"
    >
      {children}
    </Link>
  );
}
