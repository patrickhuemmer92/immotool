/**
 * POST /api/connect/webhooks/thin
 *
 * Empfängt V2 Account-Update-Events ("thin events").
 *
 * Im Stripe-Dashboard zu abonnieren:
 *   - v2.core.account[requirements].updated
 *   - v2.core.account[configuration.merchant].capability_status_updated
 *   - v2.core.account[configuration.customer].capability_status_updated
 *
 * Thin Events liefern nur eine event_id — die vollen Daten holen wir
 * via `stripe.v2.core.events.retrieve(thinEvent.id)`.
 *
 * Webhook-Secret: STRIPE_WEBHOOK_SECRET_THIN (whsec_...).
 * Im Dev:
 *   stripe listen --thin-events \
 *     'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
 *     --forward-thin-to localhost:3000/api/connect/webhooks/thin
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/connect/stripe";

export const runtime = "nodejs"; // Webhook braucht Raw-Body

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET_THIN;
  if (!sig || !secret) {
    return NextResponse.json({ error: "no_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  // parseThinEvent ist der V2-Variant von constructEvent. Cast nötig
  // weil das offizielle Type-Paket diese Methode noch nicht abdeckt.
  let thinEvent: { id: string; type: string; related_object?: { id?: string } };
  try {
    thinEvent = (stripe as unknown as {
      parseThinEvent: (
        body: string,
        sig: string,
        secret: string
      ) => { id: string; type: string; related_object?: { id?: string } };
    }).parseThinEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[connect:webhooks/thin] Signatur ungültig:", msg);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    // Full Event-Object via V2-API holen, um die Daten zu sehen.
    // Wir loggen und reagieren nur — der Status-Endpoint holt die Daten
    // anschließend live, also brauchen wir hier kein DB-Update.
    const fullEvent = (await (stripe as unknown as {
      v2: {
        core: {
          events: {
            retrieve: (id: string) => Promise<unknown>;
          };
        };
      };
    }).v2.core.events.retrieve(thinEvent.id)) as {
      id: string;
      type: string;
      data?: unknown;
      related_object?: { id?: string };
    };

    const accountId =
      fullEvent.related_object?.id ?? thinEvent.related_object?.id ?? "?";

    switch (thinEvent.type) {
      case "v2.core.account[requirements].updated":
        // Requirements haben sich geändert — der nächste Status-Abruf
        // in /connect zeigt das automatisch an. Hier nur Log.
        console.log(
          `[connect:webhooks/thin] requirements updated for ${accountId}`
        );
        break;

      case "v2.core.account[configuration.merchant].capability_status_updated":
      case "v2.core.account[configuration.customer].capability_status_updated":
        console.log(
          `[connect:webhooks/thin] capability_status updated for ${accountId} (${thinEvent.type})`
        );
        // TODO: Wenn du Push-Benachrichtigungen / E-Mails an den
        // Workspace-Owner schicken willst (z. B. "Dein Account ist
        // jetzt ready to charge"), hier triggern.
        break;

      default:
        // Andere V2-Events ignorieren.
        break;
    }
  } catch (err) {
    console.error("[connect:webhooks/thin] Handler-Fehler:", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
