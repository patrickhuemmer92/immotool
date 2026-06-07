import Link from "next/link";
import { getActiveWorkspace } from "@/lib/workspace";
import { getPremiumStatus } from "@/lib/billing/premium";
import { CancelClient } from "./cancel-client";

/**
 * § 312k BGB — Kündigungs-Button für online geschlossene Verbraucher-
 * Verträge. Pflicht seit 01.07.2022. Muss:
 *   1) Mit "Verträge hier kündigen" o. ä. eindeutig beschriftet sein
 *   2) Auf jeder Seite max. 2 Klicks entfernt erreichbar sein
 *   3) Bestätigungsseite mit Pflichtfeldern (Identifikation, Kündigungsart,
 *      Termin, ggf. Adresse) anbieten
 *   4) Eingangsbestätigung in Textform versenden
 *
 * Wir implementieren das als zwei-Schritt-Flow:
 *   - Diese Seite zeigt die Pflichtfelder + den finalen Kündigungs-Button
 *   - Der Klick triggert eine Server-Action, die den Eintrag protokolliert
 *     UND Stripe via cancel_at_period_end markiert
 */
export default async function CancellationPage() {
  const active = await getActiveWorkspace();
  if (!active) return null;

  let premium: Awaited<ReturnType<typeof getPremiumStatus>> | null = null;
  try {
    premium = await getPremiumStatus(active.id);
  } catch {
    premium = null;
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/einstellungen/abrechnung"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← Abrechnung
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Verträge hier kündigen
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Mit dieser Kündigungs-Funktion können Sie Ihren EstateAbly-Vertrag
        gemäß § 312k BGB direkt online beenden. Die Kündigung wird zum
        nächstmöglichen Zeitpunkt wirksam — bis dahin behalten Sie vollen
        Zugriff auf alle gebuchten Leistungen.
      </p>

      {!premium?.hasPaidSubscription ? (
        <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h2 className="text-base font-semibold">Kein aktives Abo</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Es ist aktuell kein zahlungspflichtiges Abonnement für Ihren
            Workspace hinterlegt. Falls Sie Ihren Account komplett löschen
            möchten, nutzen Sie die{" "}
            <Link
              href="/einstellungen"
              className="text-accent hover:underline"
            >
              Account-Löschung in den Einstellungen
            </Link>
            .
          </p>
        </div>
      ) : (
        <CancelClient
          workspaceId={active.id}
          subscribedQuantity={premium.subscribedQuantity}
        />
      )}

      <div className="mt-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
        <strong>Hinweis:</strong> Alternativ können Sie Ihre Kündigung auch
        formlos in Textform an{" "}
        <a
          href="mailto:info@estateably.de?subject=Kündigung%20EstateAbly-Abo"
          className="text-accent hover:underline"
        >
          info@estateably.de
        </a>{" "}
        senden. Die Eingangsbestätigung erhalten Sie in beiden Fällen
        per E-Mail.
      </div>
    </div>
  );
}
