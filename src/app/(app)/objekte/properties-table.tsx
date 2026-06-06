"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { PropertyKind } from "@/lib/properties";

export type PropertiesTableRow = {
  id: string;
  kind: PropertyKind;
  address: string;
  sqm: number | null;
  purchasePrice: number | null;
  marketValue: number | null;
  isDemo: boolean;
};

type SortKey = "address" | "sqm" | "purchasePrice" | "marketValue";
type SortDir = "asc" | "desc";

export function PropertiesTable({ rows }: { rows: PropertiesTableRow[] }) {
  const t = useTranslations();
  const [sortKey, setSortKey] = useState<SortKey>("address");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const list = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av = pluck(a, sortKey);
      const bv = pluck(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr className="text-left">
            <Th>{t("properties.kind_label")}</Th>
            <SortHeader
              label={t("properties.section_address")}
              active={sortKey === "address"}
              dir={sortDir}
              onClick={() => toggleSort("address")}
            />
            <SortHeader
              label={t("properties.sqm")}
              active={sortKey === "sqm"}
              dir={sortDir}
              onClick={() => toggleSort("sqm")}
              align="right"
            />
            <SortHeader
              label={t("properties.purchase_price")}
              active={sortKey === "purchasePrice"}
              dir={sortDir}
              onClick={() => toggleSort("purchasePrice")}
              align="right"
            />
            <SortHeader
              label={t("valuation.combined")}
              active={sortKey === "marketValue"}
              dir={sortDir}
              onClick={() => toggleSort("marketValue")}
              align="right"
            />
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <PropertyRow key={p.id} row={p} editLabel={t("common.edit")} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropertyRow({
  row,
  editLabel,
}: {
  row: PropertiesTableRow;
  editLabel: string;
}) {
  // "Stretched-link" Pattern: ein invisible Link über die ganze Zeile, der
  // Edit-Link in der letzten Spalte sitzt z-höher, damit er den Klick fängt.
  return (
    <tr className="relative border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group">
      <td className="px-4 py-2 align-middle relative">
        <Link
          href={`/objekte/${row.id}`}
          aria-label={row.address}
          className="absolute inset-0"
        />
        <KindBadge kind={row.kind} />
      </td>
      <Td>
        <span className="font-medium">{row.address}</span>
        {row.isDemo && (
          <span className="ml-2 inline-flex items-center rounded-full bg-accent-soft text-accent-foreground border border-accent/30 px-2 py-0.5 text-[10px] font-medium align-middle">
            Demo
          </span>
        )}
      </Td>
      <Td right>{formatNumber(row.sqm)}</Td>
      <Td right>{formatCurrency(row.purchasePrice)}</Td>
      <Td right>{formatCurrency(row.marketValue)}</Td>
      <td className="px-4 py-2 align-middle text-right relative z-10">
        <Link
          href={`/objekte/${row.id}`}
          className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
        >
          {editLabel} →
        </Link>
      </td>
    </tr>
  );
}

function pluck(r: PropertiesTableRow, k: SortKey): string | number | null {
  switch (k) {
    case "address":
      return r.address;
    case "sqm":
      return r.sqm;
    case "purchasePrice":
      return r.purchasePrice;
    case "marketValue":
      return r.marketValue;
  }
}

const KIND_BADGE: Record<PropertyKind, string> = {
  apartment:
    "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900",
  house:
    "bg-accent-soft text-accent-foreground border-accent/30",
  parking:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  commercial:
    "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  other:
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
};

function KindBadge({ kind }: { kind: PropertyKind }) {
  const t = useTranslations();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${KIND_BADGE[kind]}`}
    >
      {t(`properties.kind_${kind}`)}
    </span>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 ${
          active ? "text-neutral-900 dark:text-neutral-100" : ""
        }`}
      >
        {label}
        <SortArrow active={active} dir={dir} />
      </button>
    </th>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="opacity-30">
        <path d="M5 1 L8 4 H2 Z M5 9 L2 6 H8 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      {dir === "asc" ? (
        <path d="M5 1 L8 5 H2 Z" fill="currentColor" />
      ) : (
        <path d="M5 9 L2 5 H8 Z" fill="currentColor" />
      )}
    </svg>
  );
}

function Td({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td className={`px-4 py-2 align-middle ${right ? "text-right tabular-nums" : ""}`}>
      {children}
    </td>
  );
}

function formatNumber(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function formatCurrency(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
