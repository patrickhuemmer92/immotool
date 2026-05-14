"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    country?: string;
  };
};

/**
 * OSM Nominatim autocomplete. No API key required, but we MUST send a real
 * User-Agent / Referer header per their usage policy — Nominatim throttles to
 * 1 request/sec/IP. We debounce 350ms and abort the previous request.
 *
 * On pick, the parent receives the structured fields and can fill
 * street / postal_code / city inputs by id.
 */
export function AddressAutocomplete({
  onPick,
  placeholder,
}: {
  onPick: (parts: {
    street: string;
    postal_code: string;
    city: string;
  }) => void;
  placeholder?: string;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 4) {
      setItems([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "6");
        url.searchParams.set("countrycodes", "de,at,ch");
        url.searchParams.set("accept-language", "de");
        const res = await fetch(url.toString(), {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          setItems([]);
          return;
        }
        const data = (await res.json()) as Suggestion[];
        setItems(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  function pick(s: Suggestion) {
    const a = s.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    onPick({
      street,
      postal_code: a.postcode ?? "",
      city,
    });
    setQuery("");
    setItems([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // delay so click on a suggestion still registers
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder ?? t("address.search_placeholder")}
        className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        aria-autocomplete="list"
      />
      {open && (loading || items.length > 0 || query.trim().length >= 4) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg text-sm">
          {loading && (
            <div className="px-3 py-2 text-neutral-500 dark:text-neutral-400">
              {t("common.loading")}
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-neutral-500 dark:text-neutral-400">
              {t("address.no_results")}
            </div>
          )}
          {items.map((s, i) => (
            <button
              key={`${s.lat}-${s.lon}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className="block w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
