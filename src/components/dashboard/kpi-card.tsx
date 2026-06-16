import type { ReactNode } from "react";

/**
 * KPI-Karte im Stil des Mockups: Eyebrow oben + Icon rechts, fetter
 * Hauptwert, optionaler Subtitle. `accent` hebt eine einzige Karte
 * (Eigenkapital) in der Brand-Farbe hervor.
 */
export function DashboardKpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,27,46,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <span
          className={
            accent
              ? "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/30"
              : "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500"
          }
        >
          {icon}
        </span>
      </div>
      <div
        className={
          accent
            ? "mt-3 text-[23px] font-bold tracking-tight tabular-nums text-accent"
            : "mt-3 text-[23px] font-bold tracking-tight tabular-nums text-neutral-900"
        }
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-1.5 text-xs text-neutral-500">{sub}</div>
      ) : null}
    </div>
  );
}
