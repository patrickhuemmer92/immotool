import Link from "next/link";
import type { OwnerOption } from "@/lib/dashboard/types";

/**
 * Eigentümer-Segmented-Control. Server-rendered: jede Option ist ein
 * Link mit/ohne `?owner=<id>`. Kein React-State, der Filter ist damit
 * bookmark-bar und funktioniert auch ohne JS.
 *
 * Layout-Hinweis: bei 4+ Owners gerät der Pill-Strip sonst aus dem
 * Layout — wir lassen ihn auf Tablet/Mobile horizontal scrollen.
 */
export function DashboardOwnerFilter({
  owners,
  activeOwnerId,
  labelAll,
}: {
  owners: OwnerOption[];
  activeOwnerId: string | null;
  labelAll: string;
}) {
  // Bei nur einem Eigentümer entfällt der Filter — sonst wirkt er wie
  // eine sinnlose Dekoration.
  if (owners.length <= 1) return null;

  return (
    <nav
      aria-label="Eigentümer-Filter"
      className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 overflow-x-auto"
    >
      <OwnerLink href="/dashboard" active={activeOwnerId == null}>
        {labelAll}
      </OwnerLink>
      {owners.map((o) => (
        <OwnerLink
          key={o.id}
          href={`/dashboard?owner=${encodeURIComponent(o.id)}`}
          active={activeOwnerId === o.id}
        >
          {o.name}
        </OwnerLink>
      ))}
    </nav>
  );
}

function OwnerLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const base =
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap";
  return (
    <Link
      href={href}
      prefetch={false}
      className={
        active
          ? `${base} bg-accent text-accent-foreground`
          : `${base} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`
      }
    >
      {children}
    </Link>
  );
}
