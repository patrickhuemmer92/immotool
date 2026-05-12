"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";

export type ScheduleSeriesPoint = {
  year: number;
  balance: number;
  interestCum: number;
};

export function LoanScheduleChart({ data }: { data: ScheduleSeriesPoint[] }) {
  const t = useTranslations();

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold mb-3">{t("loans.schedule_title")}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              label={{
                value: t("loans.schedule_year"),
                position: "insideBottom",
                offset: -2,
                fontSize: 12,
              }}
            />
            <YAxis
              tickFormatter={(v) =>
                Number(v).toLocaleString("de-DE", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                })
              }
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(v) => {
                const n = typeof v === "number" ? v : Number(v);
                if (!Number.isFinite(n)) return "";
                return n.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                });
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="balance"
              name={t("loans.schedule_balance")}
              stroke="#1f2937"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="interestCum"
              name={t("loans.schedule_interest_cum")}
              stroke="#9ca3af"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
