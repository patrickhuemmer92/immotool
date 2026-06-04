import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import {
  getAccountStatus,
  getWorkspaceConnectAccount,
} from "@/lib/connect/account";
import { stripeMode } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { ConnectDashboardClient } from "./dashboard-client";

/**
 * Connect-Dashboard für Workspace-Owner.
 *
 * - Status frisch von der Stripe-API (KEIN DB-Cache)
 * - Onboarding-Button (Account-Create + AccountLink)
 * - Produkt-Verwaltung (auf Connected Account)
 * - Plattform-Subscription buchen / verwalten
 * - Storefront-Link für den Connected Account
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!isOwner(active.role)) redirect("/");

  const params = await searchParams;
  const queryStatus = typeof params.status === "string" ? params.status : null;

  const connect = await getWorkspaceConnectAccount(active.id);
  const accountStatus = connect
    ? await getAccountStatus(connect.stripeAccountId).catch((err) => {
        console.error("[connect:page] getAccountStatus failed:", err);
        return null;
      })
    : null;

  // E-Mail-Default für die Account-Create-Maske: aktueller User.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const ownerEmail = userData.user?.email ?? "";

  // Produkte auf dem Connected Account vorausladen (server-side), damit
  // die UI initial schon was zeigt — Live-Refresh läuft danach Client-
  // seitig nach jeder Mutation.
  let products: Array<{
    id: string;
    name: string;
    description: string | null;
    priceCents: number | null;
    currency: string | null;
  }> = [];
  if (connect && accountStatus?.readyToProcessPayments) {
    try {
      const { getStripe } = await import("@/lib/connect/stripe");
      const stripe = getStripe();
      const list = await stripe.products.list(
        { limit: 20, active: true, expand: ["data.default_price"] },
        { stripeAccount: connect.stripeAccountId }
      );
      products = list.data.map((p) => {
        const dp = p.default_price;
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          priceCents:
            dp && typeof dp !== "string" && dp.unit_amount != null
              ? dp.unit_amount
              : null,
          currency:
            dp && typeof dp !== "string" ? dp.currency : null,
        };
      });
    } catch (err) {
      console.error("[connect:page] products.list failed:", err);
    }
  }

  const mode = stripeMode();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("connect.title")}
      </h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {t("connect.intro")}
      </p>

      <ConnectDashboardClient
        workspaceName={active.name}
        defaultDisplayName={active.name}
        defaultContactEmail={ownerEmail}
        hasAccount={Boolean(connect)}
        stripeAccountId={connect?.stripeAccountId ?? null}
        accountStatus={accountStatus}
        platformSubscriptionId={connect?.platformSubscriptionId ?? null}
        platformSubscriptionStatus={connect?.platformSubscriptionStatus ?? null}
        platformSubscriptionEnd={connect?.platformSubscriptionCurrentPeriodEnd ?? null}
        products={products}
        queryStatus={queryStatus}
      />

      {mode === "test" && (
        <p className="mt-8 text-[11px] text-amber-700 dark:text-amber-400">
          {t("connect.test_mode_note")}
        </p>
      )}
    </div>
  );
}
