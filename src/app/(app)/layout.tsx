import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, listMemberships } from "@/lib/workspace";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { NavLink } from "@/components/nav-link";
import { Wordmark } from "@/components/wordmark";
import { PropertySidebar } from "@/components/property-sidebar";
import { logout } from "@/app/(auth)/auth-actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await listMemberships();
  const active = await getActiveWorkspace();

  if (!active) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Kein Workspace</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Du bist (noch) keinem Workspace zugeordnet.
          </p>
          <form action={logout} className="mt-4">
            <button className="text-sm underline">Abmelden</button>
          </form>
        </div>
      </main>
    );
  }

  const t = await getTranslations();

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-neutral-950">
      <aside className="w-60 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col">
        <div className="px-5 py-5 border-b border-neutral-200">
          <Link href="/" aria-label={t("app.name")} className="block">
            <Wordmark size="md" tagline />
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 text-sm">
          <NavSection>
            <NavLink href="/">{t("nav.dashboard")}</NavLink>
            <NavLink href="/objekte">{t("nav.properties")}</NavLink>
            <NavLink href="/eigentuemer">{t("nav.owners")}</NavLink>
          </NavSection>
          <NavGroup label={t("nav.finance")}>
            <NavLink href="/finanzen/guv">{t("nav.pnl")}</NavLink>
            <NavLink href="/finanzen/darlehen">{t("nav.loans")}</NavLink>
            <NavLink href="/finanzen/afa">{t("nav.depreciation")}</NavLink>
          </NavGroup>
          <NavSection>
            <NavLink href="/investitionen">{t("nav.investments")}</NavLink>
          </NavSection>
          <NavSection>
            <NavLink href="/einstellungen">{t("nav.settings")}</NavLink>
          </NavSection>
        </nav>
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="px-2 text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {user.email}
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </aside>
      <PropertySidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
          <WorkspaceSwitcher workspaces={memberships} active={active} />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function NavSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5 mb-3">{children}</div>;
}

function NavGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

