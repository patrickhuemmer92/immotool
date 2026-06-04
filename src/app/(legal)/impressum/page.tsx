import { getTranslations } from "next-intl/server";

/**
 * Impressum nach § 5 DDG (Digital-Dienste-Gesetz, ehemals TMG).
 *
 * PLATZHALTER: Inhalt von Patrick noch nachzuliefern (über e-recht24.de
 * oder anwalt.de Generator). Aktuell zeigt nur ein Hinweistext.
 *
 * Erforderliche Pflichtangaben in der finalen Version:
 *   - Name und Anschrift des Diensteanbieters
 *   - Kontakt: Telefon + E-Mail
 *   - Vertretungsberechtigte Person
 *   - Handelsregister + Reg-Nummer (bei Kapitalgesellschaft)
 *   - USt-ID (sofern vorhanden)
 *   - Verantwortlicher für journalistisch-redaktionelle Inhalte
 */
export default async function ImpressumPage() {
  const t = await getTranslations();
  return (
    <article className="prose dark:prose-invert max-w-none">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("legal.impressum_title")}
      </h1>
      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {t("legal.placeholder_intro")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.impressum_provider_heading")}
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_provider")}
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        {t("legal.impressum_contact_heading")}
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
        {t("legal.placeholder_contact")}
      </p>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("legal.placeholder_note")}
      </p>
    </article>
  );
}
