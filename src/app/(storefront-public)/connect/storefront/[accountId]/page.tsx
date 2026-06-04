import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStripe } from "@/lib/connect/stripe";
import { StorefrontClient, type StorefrontProduct } from "./storefront-client";

/**
 * Öffentliche Storefront für einen Connected Account.
 *
 * URL: /connect/storefront/[accountId]
 *
 * NOTE: Wir nutzen die Stripe-Account-ID (acct_...) direkt in der URL —
 * pragmatisch fürs Demo, aber für Production sollte ein Workspace-Slug
 * verwendet werden (siehe getWorkspaceConnectAccount), damit die Stripe-
 * Account-ID nicht öffentlich exponiert wird.
 *
 * Produkt-Listing kommt direkt vom Connected Account via Stripe-Account-
 * Header. Keine DB-Lookups, keine Authentifizierung — pure Public-API.
 */
export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accountId } = await params;
  const t = await getTranslations();

  // Defensive: Stripe-Account-IDs beginnen immer mit "acct_".
  if (!accountId.startsWith("acct_")) notFound();

  const sParams = await searchParams;
  const queryStatus =
    typeof sParams.status === "string" ? sParams.status : null;

  const stripe = getStripe();

  // Account-Display-Name + Produkte parallel holen.
  let displayName: string | null = null;
  let products: StorefrontProduct[] = [];
  try {
    const [accountRaw, productList] = await Promise.all([
      // V2-Retrieve um den Display-Name zu erfahren.
      (stripe as unknown as {
        v2: {
          core: {
            accounts: {
              retrieve: (id: string) => Promise<unknown>;
            };
          };
        };
      }).v2.core.accounts.retrieve(accountId),
      stripe.products.list(
        { limit: 20, active: true, expand: ["data.default_price"] },
        { stripeAccount: accountId }
      ),
    ]);

    const account = accountRaw as { display_name?: string | null };
    displayName = account.display_name ?? null;
    products = productList.data
      .map((p) => {
        const dp = p.default_price;
        if (!dp || typeof dp === "string" || dp.unit_amount == null) {
          return null;
        }
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          priceCents: dp.unit_amount,
          currency: dp.currency,
        };
      })
      .filter((x): x is StorefrontProduct => x !== null);
  } catch (err) {
    console.error("[storefront] Stripe lookup failed:", err);
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight">
        {displayName ?? t("storefront.fallback_title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("storefront.intro")}
      </p>

      <StorefrontClient
        accountId={accountId}
        products={products}
        queryStatus={queryStatus}
      />
    </div>
  );
}
