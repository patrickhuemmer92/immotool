"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#1f2937",
  "#374151",
  "#4b5563",
  "#6b7280",
  "#9ca3af",
  "#d1d5db",
  "#f3f4f6",
];

export function DiversificationPie({
  data,
  title,
}: {
  data: { name: string; value: number }[];
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(p) => p.name as string}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => {
                const n = typeof v === "number" ? v : Number(v);
                return Number.isFinite(n)
                  ? n.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })
                  : "";
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
