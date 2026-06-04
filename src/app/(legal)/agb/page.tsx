import { getTranslations } from "next-intl/server";

/**
 * Allgemeine Geschäftsbedingungen (AGB).
 *
 * PLATZHALTER: Inhalt von Patrick noch nachzuliefern.
 * Empfehlung: Anwaltliche Beratung — AGB sind branchenspezifisch.
 *
 * Wesentliche Sektionen:
 *   - Vertragsgegenstand
 *   - Vertragsschluss
 *   - Leistungen + Verfügbarkeit
 *   - Preise + Zahlungsbedingungen (Stripe)
 *   - Pflichten des Nutzers
 *   - Widerrufsrecht
 *   - Haftung + Haftungsausschluss
 *   - Datenschutz (Verweis auf Datenschutzerklärung)
 *   - Auftragsverarbeitung Mieter-Daten (AVV-Klausel)
 *   - Laufzeit + Kündigung
 *   - Schlussbestimmungen
 */
export default async function AgbPage() {
  const t = await getTranslations();
  return (
    <article className="prose dark:prose-invert max-w-none">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("legal.terms_title")}
      </h1>
      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {t("legal.placeholder_intro")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.terms_object_heading")}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_terms_object")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.terms_payment_heading")}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_terms_payment")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.terms_avv_heading")}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_terms_avv")}
      </p>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("legal.placeholder_note")}
      </p>
    </article>
  );
}
