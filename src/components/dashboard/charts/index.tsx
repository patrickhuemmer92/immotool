"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  CHART_COLORS,
  CATEGORY_PALETTE,
  DarkTooltip,
} from "./chart-shared";
import { formatEurAxis } from "@/lib/dashboard/format";
import type {
  AfaRow,
  CapitalRow,
  CashflowRow,
  CityRankingRow,
  DebtEquityRow,
  InvestmentRow,
  LoanMaturityRow,
  OwnerSliceRow,
} from "@/lib/dashboard/types";

/* ------------------------------------------------------------------ */
/*  1) Kaufpreis · Restschuld · Eigenkapital je Objekt                */
/* ------------------------------------------------------------------ */
export function CapitalByPropertyChart({ data }: { data: CapitalRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,27,46,0.04)" }} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Bar
          dataKey="Restschuld"
          stackId="k"
          fill={CHART_COLORS.debt}
          maxBarSize={46}
        />
        <Bar
          dataKey="Eigenkapital"
          stackId="k"
          fill={CHART_COLORS.brand}
          radius={[4, 4, 0, 0]}
          maxBarSize={46}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  2a) Marktwert nach Eigentümer — Donut                              */
/* ------------------------------------------------------------------ */
export function OwnerDonutChart({ data }: { data: OwnerSliceRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={96}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<DarkTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  2b) Marktwert nach Stadt — horizontale Balken                      */
/* ------------------------------------------------------------------ */
export function CityRankingChart({ data }: { data: CityRankingRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36 + 60)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="stadt"
          tick={{ fontSize: 12, fill: CHART_COLORS.ink }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,27,46,0.04)" }} />
        <Bar
          dataKey="marktwert"
          name="Marktwert"
          radius={[0, 4, 4, 0]}
          maxBarSize={26}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  3) Kaltmieten + Cashflow im Zeitverlauf                            */
/* ------------------------------------------------------------------ */
export function CashflowOverTimeChart({
  data,
  planCutYear,
}: {
  data: CashflowRow[];
  planCutYear: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <defs>
          <linearGradient id="gKaltmiete" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.14} />
            <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          vertical={false}
        />
        <XAxis
          dataKey="jahr"
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ stroke: CHART_COLORS.line }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <ReferenceLine
          x={planCutYear}
          stroke={CHART_COLORS.inkFaint}
          strokeDasharray="3 3"
          label={{
            value: "Plan →",
            position: "insideTopRight",
            fontSize: 10,
            fill: CHART_COLORS.inkFaint,
          }}
        />
        <Area
          type="monotone"
          dataKey="kaltmiete"
          name="Kaltmiete"
          stroke={CHART_COLORS.inkFaint}
          strokeWidth={2}
          fill="url(#gKaltmiete)"
        />
        <Line
          type="monotone"
          dataKey="cfVor"
          name="Cashflow vor Steuer"
          stroke={CHART_COLORS.brand}
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="cfNach"
          name="Cashflow nach Steuer"
          stroke={CHART_COLORS.navy}
          strokeWidth={2.5}
          strokeDasharray="5 4"
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  4a) Darlehensfälligkeiten                                          */
/* ------------------------------------------------------------------ */
export function LoanMaturitiesChart({ data }: { data: LoanMaturityRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          vertical={false}
        />
        <XAxis
          dataKey="jahr"
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,27,46,0.04)" }} />
        <Bar
          dataKey="betrag"
          name="Fällige Restschuld"
          fill={CHART_COLORS.debt}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  4b) Entwicklung Restschuld + Eigenkapital                          */
/* ------------------------------------------------------------------ */
export function DebtEquityTimelineChart({
  data,
  planCutYear,
}: {
  data: DebtEquityRow[];
  planCutYear: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <defs>
          <linearGradient id="gEquity" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.32} />
            <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="gDebt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.debt} stopOpacity={0.32} />
            <stop offset="100%" stopColor={CHART_COLORS.debt} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          vertical={false}
        />
        <XAxis
          dataKey="jahr"
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ stroke: CHART_COLORS.line }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <ReferenceLine
          x={planCutYear}
          stroke={CHART_COLORS.inkFaint}
          strokeDasharray="3 3"
          label={{
            value: "Plan →",
            position: "insideTopRight",
            fontSize: 10,
            fill: CHART_COLORS.inkFaint,
          }}
        />
        <Area
          type="monotone"
          dataKey="restschuld"
          name="Restschuld"
          stroke={CHART_COLORS.debt}
          strokeWidth={2}
          fill="url(#gDebt)"
        />
        <Area
          type="monotone"
          dataKey="eigenkapital"
          name="Eigenkapital"
          stroke={CHART_COLORS.brand}
          strokeWidth={2.5}
          fill="url(#gEquity)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  5) AfA-Zeitverlauf                                                 */
/* ------------------------------------------------------------------ */
export function AfaTimelineChart({
  data,
  planCutYear,
}: {
  data: AfaRow[];
  planCutYear: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          vertical={false}
        />
        <XAxis
          dataKey="jahr"
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,27,46,0.04)" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <ReferenceLine
          x={planCutYear}
          stroke={CHART_COLORS.inkFaint}
          strokeDasharray="3 3"
          label={{
            value: "Plan →",
            position: "insideTopRight",
            fontSize: 10,
            fill: CHART_COLORS.inkFaint,
          }}
        />
        <Bar
          dataKey="gebaude"
          name="Gebäude-AfA"
          stackId="a"
          fill={CHART_COLORS.brand}
          maxBarSize={44}
        />
        <Bar
          dataKey="beweglich"
          name="Bewegliche WG"
          stackId="a"
          fill={CHART_COLORS.navy}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  6) Investitionsplan kommende Jahre                                 */
/* ------------------------------------------------------------------ */
export function InvestmentPlanChart({ data }: { data: InvestmentRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="2 4"
          stroke={CHART_COLORS.line}
          vertical={false}
        />
        <XAxis
          dataKey="jahr"
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          tickFormatter={formatEurAxis}
          tick={{ fontSize: 11, fill: CHART_COLORS.inkSoft }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,27,46,0.04)" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar
          dataKey="sicher"
          name="Sicher"
          stackId="i"
          fill={CHART_COLORS.brand}
          maxBarSize={40}
        />
        <Bar
          dataKey="eventuell"
          name="Eventuell"
          stackId="i"
          fill={CHART_COLORS.brandSoft}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
