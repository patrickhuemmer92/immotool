"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export function AcquisitionsBar({
  data,
  title,
}: {
  data: { year: string; count: number; sum: number }[];
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v, name) => {
                const n = typeof v === "number" ? v : Number(v);
                if (!Number.isFinite(n)) return "";
                if (name === "sum") {
                  return n.toLocaleString(undefined, {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  });
                }
                return n;
              }}
            />
            <Bar dataKey="count" fill="#1f2937" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
