"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { eurExact } from "@/lib/format";
import type { DepreciationYearResult } from "@/lib/calculations/depreciation";

const HIGHLIGHTS = [1, 3, 5, 10, 15, 20, 30] as const;

export function AfaSchedule({
  startYear,
  schedule,
}: {
  startYear: number | null;
  schedule: DepreciationYearResult[];
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<"highlights" | "all">("highlights");

  const rows =
    mode === "highlights"
      ? schedule.filter((s) => (HIGHLIGHTS as readonly number[]).includes(s.year))
      : schedule;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">{t("afa.schedule_title")}</h3>
        <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs overflow-hidden">
          <ModeBtn
            active={mode === "highlights"}
            onClick={() => setMode("highlights")}
          >
            {t("afa.schedule_mode_highlights")}
          </ModeBtn>
          <ModeBtn active={mode === "all"} onClick={() => setMode("all")}>
            {t("afa.schedule_mode_all")}
          </ModeBtn>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left">
              <Th>{t("afa.schedule_year")}</Th>
              <Th>{t("afa.schedule_linear")}</Th>
              <Th>{t("afa.schedule_degressive")}</Th>
              <Th>{t("afa.schedule_sonder")}</Th>
              <Th>{t("afa.schedule_total")}</Th>
              <Th>{t("afa.schedule_book_value")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.year}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <Td>
                  {r.year}
                  {startYear != null && (
                    <span className="ml-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {startYear + r.year - 1}
                    </span>
                  )}
                </Td>
                <Td>{r.linear === 0 ? "—" : eurExact(r.linear)}</Td>
                <Td>{r.degressive === 0 ? "—" : eurExact(r.degressive)}</Td>
                <Td>{r.sonder === 0 ? "—" : eurExact(r.sonder)}</Td>
                <Td className="font-semibold">{eurExact(r.total)}</Td>
                <Td className="text-neutral-500 dark:text-neutral-400">
                  {eurExact(r.bookValue)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        {t("afa.schedule_footnote")}
      </p>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 " +
        (active
          ? "bg-accent text-accent-foreground font-medium"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
      }
    >
      {children}
    </button>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2 tabular-nums ${className ?? ""}`}>{children}</td>;
}
