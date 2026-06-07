import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Globaler Footer für die App-Layouts mit Pflicht-Links zu rechtlichen
 * Seiten (Impressum, Datenschutz, AGB).
 *
 * Wird sowohl in (app)/layout.tsx (eingeloggte Sicht) als auch in
 * (auth)/layout.tsx (Login/Signup) angezeigt — Pflichtangaben müssen
 * von überall erreichbar sein.
 */
export async function AppFooter() {
  const t = await getTranslations();
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <div>
          © {new Date().getFullYear()} {t("app.name")}
        </div>
        <nav className="flex flex-wrap items-center gap-4">
          <Link
            href="/impressum"
            className="hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline"
          >
            {t("legal.footer_impressum")}
          </Link>
          <Link
            href="/datenschutz"
            className="hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline"
          >
            {t("legal.footer_privacy")}
          </Link>
          <Link
            href="/agb"
            className="hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline"
          >
            {t("legal.footer_terms")}
          </Link>
          <Link
            href="/avv"
            className="hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline"
          >
            {t("legal.footer_avv")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
