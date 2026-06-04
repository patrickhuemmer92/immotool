import { getTranslations } from "next-intl/server";

/**
 * Datenschutzerklärung nach Art. 13/14 DSGVO.
 *
 * PLATZHALTER: Inhalt von Patrick noch nachzuliefern (über e-recht24.de
 * oder anwalt.de Generator). Aktuell zeigt nur ein strukturierter
 * Platzhalter mit den wichtigsten Pflicht-Sektionen.
 *
 * Erforderliche Sektionen in der finalen Version:
 *   - Verantwortlicher (Kontaktdaten)
 *   - Datenschutzbeauftragter (falls vorhanden)
 *   - Erhobene Daten + Zwecke (Auth, Workspace-Daten, Mieter-Daten,
 *     Cookies, Stripe-Zahlungsdaten)
 *   - Rechtsgrundlagen (Art. 6 DSGVO)
 *   - Empfänger / Drittstaaten (Supabase EU, Stripe US, Vercel US)
 *   - Speicherdauer
 *   - Betroffenenrechte (Auskunft, Löschung, Übertragbarkeit, Widerspruch)
 *   - Beschwerderecht bei Aufsichtsbehörde
 */
export default async function DatenschutzPage() {
  const t = await getTranslations();
  return (
    <article className="prose dark:prose-invert max-w-none">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("legal.privacy_title")}
      </h1>
      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {t("legal.placeholder_intro")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.privacy_data_heading")}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_privacy_data")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.privacy_subprocessors_heading")}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_privacy_subprocessors")}
      </p>
      <ul className="mt-2 text-sm text-neutral-700 dark:text-neutral-300 list-disc pl-6 space-y-1">
        <li>Supabase, Inc. (Auth + Datenbank, EU-Region)</li>
        <li>Stripe, Inc. (Zahlungsabwicklung, USA)</li>
        <li>Vercel, Inc. (Hosting, USA + Frankfurt-Region)</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.privacy_rights_heading")}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_privacy_rights")}
      </p>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("legal.placeholder_note")}
      </p>
    </article>
  );
}
