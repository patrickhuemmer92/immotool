import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors } from "./pdf-theme";

/**
 * React-PDF-Chart-Primitives für die Executive-Summary-Seite.
 * Keine SVG-Paths, nur `<View>` mit Absolute-Positioning — bewusst
 * einfach gehalten, damit das PDF schnell rendert und die
 * Rendering-Engine keine SVG-Path-Kalkulationen braucht.
 *
 * Farb-Konvention: Restschuld = Slate (muted), Eigenkapital = Teal
 * (accent), Anschaffungs-Tick = Dark Navy (text). Sekundäre Serien
 * (z. B. „Eventuell") kommen in accentLight. Abzüge im Waterfall in
 * Rose, damit „minus" auf einen Blick klar ist.
 */

const CHART_TICK_COUNT = 5;
const Y_AXIS_WIDTH = 32;
const NEGATIVE_ROSE = "#E24B4A";

const styles = StyleSheet.create({
  chartWrap: {
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#FFFFFF",
  },
  chartTitle: {
    fontSize: 8,
    color: pdfColors.textMuted,
    marginBottom: 6,
    fontFamily: "Inter-SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 7,
    color: pdfColors.textMuted,
  },
});

const eurCompact = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} M€`;
  if (abs >= 1_000)
    return `${(v / 1_000).toLocaleString("de-DE", {
      maximumFractionDigits: 0,
    })} T€`;
  return `${Math.round(v).toLocaleString("de-DE")} €`;
};

/**
 * Rundet auf ein „schönes" Achsen-Maximum (10 / 25 / 50 / 100 T€ Schritt),
 * damit die Tick-Beschriftung nicht wie „37,3 T€" aussieht.
 */
function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const norm = rawMax / pow;
  let step: number;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * pow;
}

/* ------------------------------------------------------------------ */
/*  Y-Axis-Renderer — geteilt zwischen Simple/Stacked/Waterfall        */
/* ------------------------------------------------------------------ */

function YAxis({
  max,
  min = 0,
  height,
}: {
  max: number;
  min?: number;
  height: number;
}) {
  const range = max - min;
  const ticks = Array.from({ length: CHART_TICK_COUNT }, (_, i) => {
    const value = min + (range * (CHART_TICK_COUNT - 1 - i)) / (CHART_TICK_COUNT - 1);
    return value;
  });
  return (
    <View
      style={{
        width: Y_AXIS_WIDTH,
        height,
        flexDirection: "column",
        justifyContent: "space-between",
        paddingRight: 4,
      }}
    >
      {ticks.map((v, i) => (
        <Text
          key={i}
          style={{
            fontSize: 6,
            color: pdfColors.textMuted,
            textAlign: "right",
            lineHeight: 1,
          }}
        >
          {eurCompact(v)}
        </Text>
      ))}
    </View>
  );
}

/**
 * Horizontale Gridlines im Chart-Area — Slate-hairline, damit die
 * Bars den Wert auch ohne Text-Label auf der Bar direkt ablesbar
 * machen.
 */
function GridLines({ height }: { height: number }) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {Array.from({ length: CHART_TICK_COUNT }, (_, i) => {
        const top = (height * i) / (CHART_TICK_COUNT - 1);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top,
              height: 0.5,
              backgroundColor: pdfColors.border,
            }}
          />
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Capital-Stack-Bar (horizontal, dreiteilig mit Anschaffungs-Tick)  */
/* ------------------------------------------------------------------ */

export function PdfCapitalStackBar({
  debt,
  equity,
  acquisition,
  height = 22,
}: {
  debt: number;
  equity: number;
  acquisition: number;
  height?: number;
}) {
  const total = debt + equity;
  if (total <= 0) return null;
  const debtPct = (debt / total) * 100;
  const equityPct = 100 - debtPct;
  const acqPct = Math.min(100, Math.max(0, (acquisition / total) * 100));

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          height,
          borderRadius: 3,
          overflow: "hidden",
          backgroundColor: pdfColors.border,
          position: "relative",
        }}
      >
        <View style={{ width: `${debtPct}%`, backgroundColor: pdfColors.muted }} />
        <View style={{ width: `${equityPct}%`, backgroundColor: pdfColors.accent }} />
        {acqPct > 0 && acqPct <= 100 ? (
          <View
            style={{
              position: "absolute",
              top: -3,
              bottom: -3,
              left: `${acqPct}%`,
              width: 2,
              marginLeft: -1,
              backgroundColor: pdfColors.text,
            }}
          />
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: pdfColors.muted }]} />
          <Text style={styles.legendText}>Restschuld · {eurCompact(debt)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: pdfColors.accent }]} />
          <Text style={styles.legendText}>Eigenkapital · {eurCompact(equity)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={{ width: 2, height: 8, backgroundColor: pdfColors.text }} />
          <Text style={styles.legendText}>Anschaffung · {eurCompact(acquisition)}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked-Bar-Chart mit Y-Achse                                      */
/* ------------------------------------------------------------------ */

export type StackedRow = {
  label: string;
  series1: number;
  series2: number;
};

export function PdfStackedBarChart({
  title,
  data,
  series1Label,
  series2Label,
  series1Color = pdfColors.muted,
  series2Color = pdfColors.accent,
  height = 90,
}: {
  title: string;
  data: StackedRow[];
  series1Label: string;
  series2Label: string;
  series1Color?: string;
  series2Color?: string;
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart title={title} height={height} />;

  const rawMax = Math.max(...data.map((d) => d.series1 + d.series2), 1);
  const yMax = niceMax(rawMax);

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={{ flexDirection: "row" }}>
        <YAxis max={yMax} height={height} />
        <View style={{ flex: 1, position: "relative" }}>
          <GridLines height={height} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              height,
              gap: 3,
            }}
          >
            {data.map((d, i) => {
              const total = d.series1 + d.series2;
              const totalH = (total / yMax) * height;
              const h1 = total > 0 ? (d.series1 / total) * totalH : 0;
              const h2 = total > 0 ? (d.series2 / total) * totalH : 0;
              return (
                <View
                  key={i}
                  style={{ flex: 1, height, justifyContent: "flex-end" }}
                >
                  <View
                    style={{ height: totalH, flexDirection: "column-reverse" }}
                  >
                    <View style={{ height: h1, backgroundColor: series1Color }} />
                    <View style={{ height: h2, backgroundColor: series2Color }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 3, marginLeft: Y_AXIS_WIDTH }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              fontSize: 6,
              color: pdfColors.muted,
              textAlign: "center",
            }}
            wrap={false}
          >
            {d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}
          </Text>
        ))}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: series1Color }]} />
          <Text style={styles.legendText}>{series1Label}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: series2Color }]} />
          <Text style={styles.legendText}>{series2Label}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Simple-Bar-Chart mit Y-Achse                                       */
/* ------------------------------------------------------------------ */

export function PdfSimpleBarChart({
  title,
  data,
  barColor = pdfColors.muted,
  height = 90,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  barColor?: string;
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart title={title} height={height} />;

  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const yMax = niceMax(rawMax);

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={{ flexDirection: "row" }}>
        <YAxis max={yMax} height={height} />
        <View style={{ flex: 1, position: "relative" }}>
          <GridLines height={height} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              height,
              gap: 3,
            }}
          >
            {data.map((d, i) => {
              const h = (d.value / yMax) * height;
              return (
                <View
                  key={i}
                  style={{ flex: 1, height, position: "relative" }}
                >
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: h,
                      backgroundColor: barColor,
                      borderRadius: 1,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 3, marginLeft: Y_AXIS_WIDTH }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              fontSize: 6,
              color: pdfColors.muted,
              textAlign: "center",
            }}
            wrap={false}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Waterfall-Chart                                                    */
/* ------------------------------------------------------------------ */

export type WaterfallPosition = {
  label: string;
  /** Positiv = Zufluss, Negativ = Abfluss. Für `kind='end'` das End-Total. */
  value: number;
  kind: "start" | "delta" | "end";
};

export function PdfWaterfallChart({
  title,
  data,
  height = 130,
}: {
  title: string;
  data: WaterfallPosition[];
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart title={title} height={height} />;

  // Running-Total pro Position rechnen → Bar-Range [von, bis]
  const bars: Array<{
    label: string;
    from: number;
    to: number;
    kind: WaterfallPosition["kind"];
    signedValue: number;
  }> = [];
  let running = 0;
  for (const p of data) {
    if (p.kind === "start") {
      running = p.value;
      bars.push({
        label: p.label,
        from: 0,
        to: p.value,
        kind: p.kind,
        signedValue: p.value,
      });
    } else if (p.kind === "end") {
      bars.push({
        label: p.label,
        from: 0,
        to: p.value,
        kind: p.kind,
        signedValue: p.value,
      });
    } else {
      const from = running;
      running += p.value;
      bars.push({
        label: p.label,
        from: Math.min(from, running),
        to: Math.max(from, running),
        kind: p.kind,
        signedValue: p.value,
      });
    }
  }

  const maxVal = Math.max(...bars.map((b) => b.to));
  const minVal = Math.min(...bars.map((b) => b.from), 0);
  const yMax = niceMax(Math.max(Math.abs(maxVal), Math.abs(minVal)));
  const range = yMax; // wir nehmen 0..yMax als Y-Range; negative Werte fangen wir mit Absolute-Werten ab

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={{ flexDirection: "row" }}>
        <YAxis max={yMax} height={height} />
        <View style={{ flex: 1, position: "relative" }}>
          <GridLines height={height} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              height,
              gap: 3,
            }}
          >
            {bars.map((b, i) => {
              const barH = ((b.to - b.from) / range) * height;
              const bottomOffset = (b.from / range) * height;
              const isCost = b.kind === "delta" && b.signedValue < 0;
              const color = isCost ? NEGATIVE_ROSE : pdfColors.accent;
              return (
                <View
                  key={i}
                  style={{ flex: 1, height, position: "relative" }}
                >
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: bottomOffset,
                      height: barH,
                      backgroundColor: color,
                      borderRadius: 1,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 3, marginLeft: Y_AXIS_WIDTH }}>
        {bars.map((b, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 6,
                color: pdfColors.muted,
                textAlign: "center",
              }}
              wrap={false}
            >
              {b.label.length > 12 ? b.label.slice(0, 11) + "…" : b.label}
            </Text>
            <Text
              style={{
                fontSize: 6,
                color: b.kind === "delta" && b.signedValue < 0
                  ? NEGATIVE_ROSE
                  : pdfColors.text,
                textAlign: "center",
                fontFamily: "Inter-SemiBold",
              }}
              wrap={false}
            >
              {b.kind === "delta" && b.signedValue < 0 ? "−" : ""}
              {eurCompact(Math.abs(b.signedValue))}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: pdfColors.accent }]} />
          <Text style={styles.legendText}>Zufluss / Ergebnis</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: NEGATIVE_ROSE }]} />
          <Text style={styles.legendText}>Abzug</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Tenancy-Timeline — "Vermietet seit"                                */
/* ------------------------------------------------------------------ */

export type TenancyRow = {
  label: string;
  /** ISO-Date des Mietbeginns. */
  contractStart: string;
  /** ISO-Date des Vertragsendes; NULL bei unbefristet. */
  contractEnd: string | null;
  isActive: boolean;
};

export function PdfTenancyTimeline({
  title,
  data,
  todayIso,
  height = 130,
}: {
  title: string;
  data: TenancyRow[];
  todayIso: string;
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart title={title} height={height} />;

  const today = new Date(todayIso).getTime();
  const startEpoch = Math.min(
    ...data.map((d) => new Date(d.contractStart).getTime())
  );
  // X-Achse: von frühestem Vertragsstart bis heute. Etwas Puffer nach
  // vorne, damit die Balken nicht am linken Rand kleben.
  const rangeMs = today - startEpoch;
  const paddedStart = startEpoch - rangeMs * 0.05;
  const paddedEnd = today + rangeMs * 0.02;
  const totalRange = paddedEnd - paddedStart;

  // Jahres-Ticks für die X-Achse
  const startYear = new Date(paddedStart).getUTCFullYear();
  const endYear = new Date(paddedEnd).getUTCFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  // Max 6 Jahres-Labels — sonst wird's zu eng
  const step = Math.max(1, Math.ceil(years.length / 6));
  const shownYears = years.filter((_, i) => i % step === 0);

  const rowHeight = Math.max(10, Math.floor(height / data.length));
  const chartHeight = rowHeight * data.length;

  const pctFor = (iso: string): number => {
    const ms = new Date(iso).getTime();
    return ((ms - paddedStart) / totalRange) * 100;
  };

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={{ position: "relative" }}>
        {/* Vertikale Jahres-Gitter */}
        {shownYears.map((y) => {
          const yearIso = `${y}-01-01`;
          const left = pctFor(yearIso);
          if (left < 0 || left > 100) return null;
          return (
            <View
              key={y}
              style={{
                position: "absolute",
                top: 0,
                left: `${left}%`,
                width: 0.5,
                height: chartHeight,
                backgroundColor: pdfColors.border,
              }}
            />
          );
        })}

        {/* Bars — eine pro Objekt */}
        {data.map((row, i) => {
          const left = pctFor(row.contractStart);
          const endIso = row.contractEnd && !row.isActive
            ? row.contractEnd
            : todayIso;
          const right = pctFor(endIso);
          const width = Math.max(1, right - left);
          const barColor = row.isActive ? pdfColors.accent : pdfColors.muted;
          return (
            <View
              key={i}
              style={{
                height: rowHeight,
                position: "relative",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${width}%`,
                  height: rowHeight - 4,
                  top: 2,
                  backgroundColor: barColor,
                  borderRadius: 1,
                }}
              />
              <Text
                style={{
                  position: "absolute",
                  left: 3,
                  top: (rowHeight - 6) / 2,
                  fontSize: 6,
                  color: "#FFFFFF",
                  fontFamily: "Inter-SemiBold",
                }}
                wrap={false}
              >
                {row.label.length > 18 ? row.label.slice(0, 17) + "…" : row.label}
              </Text>
              <Text
                style={{
                  position: "absolute",
                  right: 3,
                  top: (rowHeight - 6) / 2,
                  fontSize: 6,
                  color: pdfColors.text,
                }}
                wrap={false}
              >
                seit {new Date(row.contractStart).getUTCFullYear()}
              </Text>
            </View>
          );
        })}
      </View>

      {/* X-Achse: Jahres-Labels */}
      <View style={{ position: "relative", height: 8, marginTop: 2 }}>
        {shownYears.map((y) => {
          const left = pctFor(`${y}-01-01`);
          if (left < 0 || left > 100) return null;
          return (
            <Text
              key={y}
              style={{
                position: "absolute",
                left: `${left}%`,
                fontSize: 6,
                color: pdfColors.muted,
                transform: "translateX(-50%)",
              }}
            >
              {y}
            </Text>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: pdfColors.accent }]} />
          <Text style={styles.legendText}>aktiv vermietet</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: pdfColors.muted }]} />
          <Text style={styles.legendText}>Vertrag ausgelaufen</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty-State                                                        */
/* ------------------------------------------------------------------ */

function EmptyChart({ title, height }: { title: string; height: number }) {
  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View
        style={{
          height,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 7, color: pdfColors.textMuted }}>
          keine Daten
        </Text>
      </View>
    </View>
  );
}

export { eurCompact };
