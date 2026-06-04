import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Wordmark } from "@/components/wordmark";

/**
 * Layout für die öffentliche Connected-Account-Storefront. Bewusst
 * minimal — keine App-Sidebar, kein Auth-Check, damit Endkunden ohne
 * Login einkaufen können. Liegt deshalb außerhalb von (app)/.
 */
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="h-14 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Home" className="block">
          <Wordmark size="sm" />
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
