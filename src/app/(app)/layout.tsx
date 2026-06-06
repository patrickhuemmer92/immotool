import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, listMemberships } from "@/lib/workspace";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { PropertySidebar } from "@/components/property-sidebar";
import { AppFooter } from "@/components/app-footer";
import { TopbarAccount } from "@/components/topbar-account";
import { AppSidebar, type SidebarGroup } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";
import { logout } from "@/app/(auth)/auth-actions";
import { getPremiumStatus } from "@/lib/billing/premium";

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
  // Stripe-Trial gewinnt, falls einer aktiv ist; sonst der Workspace-
  // Setup-Trial (7 Tage ab Workspace-Anlage). Beide hängen am gleichen
  // Premium-Gate — was die Topbar zeigt, ist genau das, was die Backend-
  // Logik durchsetzt.
  const stripeTrialDays =
    premiumStatus?.stripeTrialEnd
      ? daysBetween(new Date(premiumStatus.stripeTrialEnd), now)
      : null;
  const signupTrialDays = premiumStatus?.inSignupTrial
    ? daysBetween(new Date(premiumStatus.signupTrialEndsAt!), now)
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

  const sidebarGroups: SidebarGroup[] = [
    {
      heading: t("nav.overview_group"),
      items: [
        { href: "/", label: t("nav.dashboard"), icon: "dashboard" },
        { href: "/objekte", label: t("nav.properties"), icon: "building" },
        { href: "/portfolios", label: t("nav.portfolios"), icon: "briefcase" },
        { href: "/eigentuemer", label: t("nav.owners"), icon: "user" },
        { href: "/mieter", label: t("nav.tenants"), icon: "users" },
      ],
    },
    {
      heading: t("nav.finance"),
      items: [
        { href: "/finanzen/guv", label: t("nav.pnl"), icon: "calculator" },
        { href: "/finanzen/darlehen", label: t("nav.loans"), icon: "building-bank" },
        { href: "/finanzen/afa", label: t("nav.depreciation"), icon: "chart-line" },
      ],
    },
    {
      items: [
        { href: "/investitionen", label: t("nav.investments"), icon: "trending-up" },
        { href: "/simulationen", label: t("nav.simulations"), icon: "wand" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-neutral-950">
      <CommandPalette />
      <AppSidebar
        groups={sidebarGroups}
        brandLabel={t("app.name")}
        brandTagline={t("app.tagline")}
        collapseLabelOn={t("nav.collapse")}
        collapseLabelOff={t("nav.expand")}
      />
      <PropertySidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
          <WorkspaceSwitcher workspaces={memberships} active={active} />
          <div className="flex items-center gap-3">
            <CommandPaletteTrigger />
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


