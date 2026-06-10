"use client";

import { formatEuro } from "@/lib/dashboard/format";

/**
 * Geteilte Tokens und Tooltip-Komponente für alle Dashboard-Charts.
 * Brand-Farbe Teal #00E5C7 bleibt als Akzent erhalten; Restschuld zeigen
 * wir bewusst in Slate, damit der Akzent dem Eigenkapital gehört.
 *
 * Die Werte landen über CSS-Variablen NICHT — Recharts möchte echte
 * Strings (HEX/RGB) für stroke/fill. Wir halten sie zentral, falls
 * sich die Markenfarbe später ändert.
 */
export const CHART_COLORS = {
  brand: "#00E5C7", // Estateably-Teal — Eigenkapital, Cashflow-Akzent
  brandSoft: "#A4F4E6",
  ink: "#0F1B2E",
  inkSoft: "#5B6B82",
  inkFaint: "#9AA7BD",
  line: "#E8ECF2",
  debt: "#9AA7BD", // Slate für Restschuld
  navy: "#1E3A5F", // Sekundäre Akzent-Linie (CF nach Steuer)
  amber: "#F4A63B",
  rose: "#FF6F61",
  positive: "#34B36B",
} as const;

/** Kategoriale Palette für PieChart / Stadt-Ranking. */
export const CATEGORY_PALETTE = [
  CHART_COLORS.brand,
  CHART_COLORS.navy,
  "#7C5CFF",
  CHART_COLORS.amber,
  CHART_COLORS.positive,
  CHART_COLORS.rose,
] as const;

type TooltipPayload = Array<{
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}>;

/**
 * Dunkler Tooltip im Stil des Mockups. Recharts-Tooltip nimmt
 * `content={...}` und ruft die Komponente mit `active/payload/label`
 * auf.
 */
export function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[180px] rounded-lg bg-neutral-900 px-3 py-2.5 text-xs text-white shadow-xl">
      {label != null ? (
        <div className="mb-1.5 font-semibold opacity-95">{String(label)}</div>
      ) : null}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: p.color ?? p.fill ?? "currentColor" }}
            />
            <span className="text-neutral-300">{p.name}</span>
            <span className="ml-auto font-semibold">
              {formatPayloadValue(p.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatPayloadValue(v: unknown): string {
  if (typeof v === "number") return formatEuro(v);
  if (v == null) return "—";
  return String(v);
}
