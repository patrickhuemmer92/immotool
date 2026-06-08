import Link from "next/link";

/**
 * Marketing-Footer mit den Pflicht-Legal-Links. Dynamisches Jahr — kein
 * "use client" nötig, weil das Server-Rendering den aktuellen Wert liefert.
 */
export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-mk py-16">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-baseline text-lg font-bold tracking-tight">
            <span>Estate</span>
            <span className="text-mk-primary">Ably</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mk-muted">
            Das digitale Factbook für Immobilien.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
          >
            Kostenlos starten
          </Link>
        </div>
        <div>
          <h4 className="eyebrow mb-5">Produkt</h4>
          <ul className="space-y-3 text-sm text-mk-muted">
            <li>
              <Link href="/#module" className="hover:text-mk-foreground">
                Module
              </Link>
            </li>
            <li>
              <Link href="/#factbook" className="hover:text-mk-foreground">
                Factbook
              </Link>
            </li>
            <li>
              <Link href="/preise" className="hover:text-mk-foreground">
                Preise
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-mk-foreground">
                Anmelden
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="eyebrow mb-5">Rechtliches</h4>
          <ul className="space-y-3 text-sm text-mk-muted">
            <li>
              <Link href="/impressum" className="hover:text-mk-foreground">
                Impressum
              </Link>
            </li>
            <li>
              <Link href="/datenschutz" className="hover:text-mk-foreground">
                Datenschutz
              </Link>
            </li>
            <li>
              <Link href="/agb" className="hover:text-mk-foreground">
                AGB
              </Link>
            </li>
            <li>
              <Link href="/avv" className="hover:text-mk-foreground">
                AVV
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-7xl border-t border-mk px-6 pt-6 text-xs text-mk-muted">
        © {year} EstateAbly
      </div>
    </footer>
  );
}
