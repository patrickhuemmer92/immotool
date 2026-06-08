import Link from "next/link";

const sectionLinks = [
  { href: "/#problem", label: "Problem" },
  { href: "/#loesung", label: "Lösung" },
  { href: "/#module", label: "Module" },
  { href: "/#factbook", label: "Factbook" },
  { href: "/#fuer-wen", label: "Für wen" },
  { href: "/preise", label: "Preise" },
];

/**
 * Marketing-Navigation. Bewusst Server-Component — kein State, kein Listener,
 * nur Anker- und Routen-Links. Login zeigt auf den App-Auth-Flow, "Kostenlos
 * starten" auf die Registrierung.
 */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-mk bg-mk-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-baseline text-lg font-bold tracking-tight"
        >
          <span>Estate</span>
          <span className="text-mk-primary">Ably</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-mk-muted lg:flex">
          {sectionLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-mk-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm text-mk-muted transition-colors hover:text-mk-foreground sm:inline"
          >
            Anmelden
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
          >
            Kostenlos starten
          </Link>
        </div>
      </div>
    </header>
  );
}
