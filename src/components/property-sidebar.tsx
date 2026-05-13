"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { propertyHeadline } from "@/lib/properties";

type PropertySummary = {
  street: string;
  postal_code: string;
  city: string;
  description: string | null;
  location_detail: string | null;
};

const PROPERTY_ID_PATTERN =
  /^\/objekte\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/;

/**
 * When the user is inside a property route (`/objekte/<uuid>/...`), this
 * sidebar surfaces all sub-pages in one column so they can hop between
 * Bilder, Darlehen, Mieter, Cashflow, etc. without going back to the
 * factsheet. Renders nothing outside property routes.
 */
export function PropertySidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const match = pathname.match(PROPERTY_ID_PATTERN);
  const propertyId = match?.[1] ?? null;

  const [property, setProperty] = useState<PropertySummary | null>(null);

  useEffect(() => {
    if (!propertyId) {
      setProperty(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("properties")
      .select("street, postal_code, city, description, location_detail")
      .eq("id", propertyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProperty((data as PropertySummary | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (!propertyId) return null;

  const headline = property
    ? propertyHeadline(property)
    : { street: "…", cityLine: "", detail: "" };

  const base = `/objekte/${propertyId}`;
  const items: { href: string; label: string }[] = [
    { href: base, label: t("property_nav.overview") },
    { href: `${base}/bearbeiten`, label: t("properties.go_to_edit") },
    { href: `${base}/bilder`, label: t("properties.go_to_images") },
    { href: `${base}/darlehen`, label: t("properties.go_to_loans") },
    { href: `${base}/mieter`, label: t("tenants.title") },
    { href: `${base}/guv`, label: t("pnl.title") },
    { href: `${base}/bewertung`, label: t("valuation.title") },
    { href: `${base}/investitionen`, label: t("investments.title") },
    { href: `${base}/afa`, label: t("afa.title") },
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
      {/* Teal accent strip to make the property context visually distinct */}
      <div className="h-1 bg-accent" />

      <div className="px-4 py-4 border-b border-neutral-200">
        <Link
          href="/objekte"
          className="text-xs text-neutral-500 hover:text-accent transition-colors"
        >
          ← {t("property_nav.back_to_list")}
        </Link>
        <div className="mt-3">
          <p className="text-sm font-bold tracking-tight text-neutral-900 truncate">
            {headline.street}
          </p>
          <p className="text-xs text-neutral-500 truncate">{headline.cityLine}</p>
          {headline.detail && (
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {headline.detail}
            </p>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 text-sm">
        {items.map((it) => {
          const active =
            it.href === base
              ? pathname === base
              : pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={
                "block rounded-md px-2 py-1.5 transition-colors " +
                (active
                  ? "bg-accent-soft text-accent-foreground font-medium border-l-2 border-accent -ml-[2px] pl-[10px]"
                  : "text-neutral-700 hover:bg-neutral-100")
              }
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
