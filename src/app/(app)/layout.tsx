import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, listMemberships } from "@/lib/workspace";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { NavLink } from "@/components/nav-link";
import { Wordmark } from "@/components/wordmark";
import { PropertySidebar } from "@/components/property-sidebar";
import { AppFooter } from "@/components/app-footer";
import { TopbarAccount } from "@/components/topbar-account";
import { logout } from "@/app/(auth)/auth-actions";
import { getPremiumStatus } from "@/lib/billing/premium";

const SIGNUP_TRIAL_DAYS = 7;

function daysBetween(future: Date, now: Date): number {
  const ms = future.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

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

  // Premium-/Trial-Status für die Topbar (kein Crash, falls Billing-Tabellen
  // fehlen — der Endpoint liefert sichere Defaults).
  let premiumStatus: Awaited<ReturnType<typeof getPremiumStatus>> | null = null;
  try {
    premiumStatus = await getPremiumStatus(active.id);
  } catch {
    premiumStatus = null;
  }
  const now = new Date();
  const stripeTrialDays =
    premiumStatus?.stripeTrialEnd
      ? daysBetween(new Date(premiumStatus.stripeTrialEnd), now)
      : null;
  const signupTrialEnd = new Date(
    new Date(user.created_at).getTime() +
      SIGNUP_TRIAL_DAYS * 24 * 60 * 60 * 1000
  );
  const signupTrialDays =
    !premiumStatus?.hasPaidSubscription && signupTrialEnd.getTime() > now.getTime()
      ? daysBetween(signupTrialEnd, now)
      : null;
  const trialDaysRemaining =
    stripeTrialDays != null && stripeTrialDays >= 0
      ? stripeTrialDays
      : signupTrialDays;
  const hasPaidSubscription = premiumStatus?.hasPaidSubscription ?? false;
  const tierLabel = hasPaidSubscription
    ? t("topbar.tier_premium")
    : t("topbar.tier_free");
  const showUpgradeCta = !hasPaidSubscription;

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
            <NavLink href="/portfolios">{t("nav.portfolios")}</NavLink>
            <NavLink href="/eigentuemer">{t("nav.owners")}</NavLink>
            <NavLink href="/mieter">{t("nav.tenants")}</NavLink>
          </NavSection>
          <NavGroup label={t("nav.finance")}>
            <NavLink href="/finanzen/guv">{t("nav.pnl")}</NavLink>
            <NavLink href="/finanzen/darlehen">{t("nav.loans")}</NavLink>
            <NavLink href="/finanzen/afa">{t("nav.depreciation")}</NavLink>
          </NavGroup>
          <NavSection>
            <NavLink href="/investitionen">{t("nav.investments")}</NavLink>
            <NavLink href="/simulationen">{t("nav.simulations")}</NavLink>
            {/* Stripe Connect (Marketplace-Mode) ist bewusst NICHT in der
                Nav: die Plattform empfängt selbst Zahlungen (Stripe Billing),
                kein Marketplace-Use-Case. Code unter /connect bleibt für
                spätere Reaktivierung erhalten. */}
          </NavSection>
          <NavSection>
            <NavLink href="/einstellungen">{t("nav.settings")}</NavLink>
          </NavSection>
        </nav>
      </aside>
      <PropertySidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
          <WorkspaceSwitcher workspaces={memberships} active={active} />
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <TopbarAccount
              email={user.email ?? ""}
              trialDaysRemaining={trialDaysRemaining}
              hasPaidSubscription={hasPaidSubscription}
              tierLabel={tierLabel}
              showUpgradeCta={showUpgradeCta}
            />
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
        <AppFooter />
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

