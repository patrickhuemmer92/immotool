/**
 * Server-Helpers für Premium-Gates auf Pages und API-Routes.
 *
 * Verwendung in einer Server Component:
 *
 *   const gate = await requirePremiumOrLock(workspaceId);
 *   if (gate.locked) return <PremiumLocked feature="portfolios" />;
 *
 * Verwendung in einer API-Route:
 *
 *   const gate = await requirePremiumOrLock(workspaceId);
 *   if (gate.locked) return NextResponse.json({ error: "premium_required" }, { status: 402 });
 */

import "server-only";
import { getPremiumStatus, type PremiumStatus } from "./premium";

export type PremiumGateResult =
  | { locked: false; status: PremiumStatus }
  | { locked: true; status: PremiumStatus; reason: "needs_subscription" | "needs_quantity_upgrade" };

/**
 * Liefert den Premium-Status und gibt zusätzlich an, ob die aktuelle Page
 * gelockt werden soll. Nutzt `getPremiumStatus()` als Source-of-Truth.
 */
export async function requirePremiumOrLock(
  workspaceId: string
): Promise<PremiumGateResult> {
  const status = await getPremiumStatus(workspaceId);
  if (status.isPremium) return { locked: false, status };
  return {
    locked: true,
    status,
    reason: status.needsQuantityUpgrade
      ? "needs_quantity_upgrade"
      : "needs_subscription",
  };
}
