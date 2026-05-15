"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type PortfolioBalanceRow = {
  label: string;
  purchase: number;
  remaining: number;
  equity: number;
};

export function PortfolioBalanceBar({
  data,
  title,
  labels,
}: {
  data: PortfolioBalanceRow[];
  title: string;
  labels: { purchase: string; remaining: string; equity: string };
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="purchase" name={labels.purchase} fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="remaining" name={labels.remaining} fill="#dc2626" radius={[4, 4, 0, 0]} />
            <Bar dataKey="equity" name={labels.equity} fill="#1f2937" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
