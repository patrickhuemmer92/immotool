"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type PortfolioTotalsRow = {
  key: "purchase" | "remaining" | "equity";
  label: string;
  value: number;
};

/**
 * Portfolio-level totals bar chart — three bars (Kaufpreis · Restschuld ·
 * Eigenkapital). Replaces the older per-property breakdown that became
 * unreadable for portfolios with many objects.
 */
export function PortfolioTotalsBar({
  data,
  title,
}: {
  data: PortfolioTotalsRow[];
  title: string;
}) {
  const colors: Record<PortfolioTotalsRow["key"], string> = {
    purchase: "#0f766e",
    remaining: "#dc2626",
    equity: "#1f2937",
  };
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                typeof v === "number"
                  ? v.toLocaleString("de-DE", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    })
                  : String(v)
              }
            />
            <Tooltip
              formatter={(v) => {
                const n = typeof v === "number" ? v : Number(v);
                return Number.isFinite(n)
                  ? n.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })
                  : "—";
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((row) => (
                <Cell key={row.key} fill={colors[row.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
