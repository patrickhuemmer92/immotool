import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Wordmark } from "@/components/wordmark";

/**
 * Layout für rechtliche Seiten (Impressum, Datenschutz, AGB).
 * Bewusst öffentlich erreichbar — KEIN Auth-Check, damit Pflichtangaben
 * auch ohne Login sichtbar sind (TMG-/DSGVO-Anforderung).
 *
 * Die Middleware-Allowlist in src/lib/supabase/middleware.ts erlaubt
 * Anonymen Zugriff auf /datenschutz, /impressum, /agb.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="h-14 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Home">
          <Wordmark size="sm" />
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex-1 p-8 overflow-auto max-w-3xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
