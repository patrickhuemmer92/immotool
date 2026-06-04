/**
 * Server-Helpers für Stripe-Connect-Account-Operationen.
 *
 * Die Source-of-Truth für Onboarding-Status, Capabilities und
 * Requirements ist IMMER die Stripe-API — wir cachen den Status NICHT
 * in unserer DB, um nicht aus Versehen veraltete Werte zu rendern.
 * Lediglich die Account-ID (`acct_...`) speichern wir in
 * public.connect_accounts.
 */

import "server-only";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "./stripe";

export interface WorkspaceConnectAccount {
  workspaceId: string;
  stripeAccountId: string;
  platformSubscriptionId: string | null;
  platformSubscriptionStatus: string | null;
  platformSubscriptionCurrentPeriodEnd: string | null;
}

/**
 * Holt das Connect-Mapping eines Workspaces aus der DB.
 * Returnt `null`, wenn der Workspace noch kein Connect-Account hat.
 */
export async function getWorkspaceConnectAccount(
  workspaceId: string
): Promise<WorkspaceConnectAccount | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connect_accounts")
    .select(
      "workspace_id, stripe_account_id, platform_subscription_id, platform_subscription_status, platform_subscription_current_period_end"
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return null;
  return {
    workspaceId: data.workspace_id,
    stripeAccountId: data.stripe_account_id,
    platformSubscriptionId: data.platform_subscription_id ?? null,
    platformSubscriptionStatus: data.platform_subscription_status ?? null,
    platformSubscriptionCurrentPeriodEnd:
      data.platform_subscription_current_period_end ?? null,
  };
}

/**
 * Liefert den aktuellen Onboarding-Status eines Connected Accounts.
 *
 * Quelle: Stripe-API live (`v2.core.accounts.retrieve`). Wir holen die
 * Merchant-Konfiguration und die Requirements mit, um zu entscheiden:
 *   - `readyToProcessPayments`: card_payments-Capability aktiv?
 *   - `onboardingComplete`: keine offenen Requirements mehr?
 *
 * Die Konvention für die Requirements-Auswertung kommt aus den Stripe-
 * Docs für V2 Accounts (Account[requirements].updated Event).
 */
export interface AccountStatus {
  accountId: string;
  displayName: string | null;
  contactEmail: string | null;
  country: string | null;
  readyToProcessPayments: boolean;
  onboardingComplete: boolean;
  /** Roher Stripe-Status der Requirements ("currently_due", "past_due", ...). */
  requirementsStatus: string | null;
  /** Detaillierte Liste offener Anforderungen, für Debug-Anzeige. */
  dueRequirements: string[];
}

export async function getAccountStatus(
  stripeAccountId: string
): Promise<AccountStatus> {
  const stripe = getStripe();

  // V2-Account mit Merchant-Config + Requirements abfragen.
  // `include` ist die V2-Variante des "expand" — wir wollen die zwei
  // Sub-Objekte nicht extra nachladen müssen.
  // Cast: das offizielle Type-Paket markiert manche V2-Felder als
  // noch nicht vollständig typisiert; wir kapseln die Felder, die wir
  // brauchen, in einem schmalen Inline-Type.
  const raw = (await (stripe as unknown as {
    v2: {
      core: {
        accounts: {
          retrieve: (id: string, opts: { include: string[] }) => Promise<unknown>;
        };
      };
    };
  }).v2.core.accounts.retrieve(stripeAccountId, {
    include: ["configuration.merchant", "requirements"],
  })) as {
    id: string;
    display_name?: string | null;
    contact_email?: string | null;
    identity?: { country?: string | null } | null;
    configuration?: {
      merchant?: {
        capabilities?: {
          card_payments?: { status?: string } | null;
        } | null;
      } | null;
    } | null;
    requirements?: {
      summary?: {
        minimum_deadline?: { status?: string | null } | null;
      } | null;
      entries?: Array<{ requirement?: string; description?: string }> | null;
    } | null;
  };

  const cardPaymentsStatus =
    raw.configuration?.merchant?.capabilities?.card_payments?.status ?? null;
  const requirementsStatus =
    raw.requirements?.summary?.minimum_deadline?.status ?? null;

  const readyToProcessPayments = cardPaymentsStatus === "active";
  const onboardingComplete =
    requirementsStatus !== "currently_due" && requirementsStatus !== "past_due";

  const dueRequirements = (raw.requirements?.entries ?? [])
    .map((e) => e.requirement)
    .filter((x): x is string => typeof x === "string");

  return {
    accountId: raw.id,
    displayName: raw.display_name ?? null,
    contactEmail: raw.contact_email ?? null,
    country: raw.identity?.country ?? null,
    readyToProcessPayments,
    onboardingComplete,
    requirementsStatus,
    dueRequirements,
  };
}

/**
 * Legt einen neuen V2-Connected-Account an und persistiert das Mapping.
 *
 * Nur die im Brief vorgegebenen Felder werden gesetzt — KEIN `type` auf
 * Top-Level (deprecated bei V2). Das Default-Land kommt aus der env
 * (CONNECT_DEFAULT_COUNTRY), fällt zurück auf "DE".
 */
export async function createWorkspaceConnectAccount(args: {
  workspaceId: string;
  displayName: string;
  contactEmail: string;
}): Promise<string> {
  const stripe = getStripe();
  const country = process.env.CONNECT_DEFAULT_COUNTRY ?? "DE";

  // V2-Endpoint — Cast wie oben, weil das Type-Paket V2 noch nicht
  // vollständig abdeckt.
  const created = (await (stripe as unknown as {
    v2: {
      core: {
        accounts: {
          create: (params: Record<string, unknown>) => Promise<{ id: string }>;
        };
      };
    };
  }).v2.core.accounts.create({
    display_name: args.displayName,
    contact_email: args.contactEmail,
    identity: {
      country,
    },
    dashboard: "full",
    defaults: {
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    configuration: {
      customer: {},
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
    },
  })) as { id: string };

  // Persistieren in unserer Mapping-Tabelle (security-definer-RPC; läuft
  // ohne service_role).
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { error } = await supabase.rpc("upsert_connect_account", {
    p_workspace_id: args.workspaceId,
    p_stripe_account_id: created.id,
  });
  if (error) {
    console.error(
      "[connect:createAccount] DB-Upsert fehlgeschlagen — Stripe-Account wurde aber bereits erstellt:",
      error
    );
    throw new Error(
      `Stripe-Account ${created.id} erstellt, aber Mapping konnte nicht gespeichert werden: ${error.message}`
    );
  }
  return created.id;
}

/**
 * Stripe.Subscription-Helper-Typ — wir nutzen nur eine Untermenge der
 * Felder im Webhook und im UI, daher dieser schmale Cast.
 */
export type ThinSubscription = Stripe.Subscription & {
  current_period_end?: number;
};
