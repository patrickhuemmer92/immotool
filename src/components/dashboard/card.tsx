import type { ReactNode } from "react";

/**
 * Grundkarte für alle Chart- und KPI-Kacheln. Spalten-Span steuert,
 * wie viele Spalten die Karte im 3-Spalten-Grid einnimmt; der Default
 * ist 1.
 */
export function DashboardCard({
  title,
  hint,
  span,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  span?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  const spanClass =
    span === 3
      ? "lg:col-span-3"
      : span === 2
        ? "lg:col-span-2"
        : "lg:col-span-1";
  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,27,46,0.04)] flex flex-col ${spanClass} ${className ?? ""}`}
    >
      {title || hint ? (
        <header className="mb-3">
          {title ? (
            <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
              {title}
            </h3>
          ) : null}
          {hint ? (
            <p className="mt-0.5 text-[11.5px] text-neutral-500">{hint}</p>
          ) : null}
        </header>
      ) : null}
      <div className="flex-1">{children}</div>
    </section>
  );
}
