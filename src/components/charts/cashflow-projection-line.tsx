"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export type CashflowProjectionPoint = {
  year: number;
  afterTax: number;
};

/**
 * Portfolio-level time-series chart for "Cashflow nach Steuer p.a."
 * Each point is the sum across all properties for that calendar year.
 */
export function CashflowProjectionLine({
  data,
  title,
}: {
  data: CashflowProjectionPoint[];
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
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
              labelFormatter={(label) => `Jahr ${label}`}
            />
            <Line
              type="monotone"
              dataKey="afterTax"
              stroke="#0f766e"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
