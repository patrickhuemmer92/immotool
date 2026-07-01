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
 * (z. B. „Eventuell") kommen in accentLight.
 */

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
  /** Anschaffungspreis inkl. Nebenkosten — Tick auf der Bar. */
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
        <View
          style={{
            width: `${debtPct}%`,
            backgroundColor: pdfColors.muted,
          }}
        />
        <View
          style={{
            width: `${equityPct}%`,
            backgroundColor: pdfColors.accent,
          }}
        />
        {/* Anschaffungs-Tick — 2px vertikaler Strich in Text-Farbe. */}
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
          <View
            style={[styles.legendSwatch, { backgroundColor: pdfColors.muted }]}
          />
          <Text style={styles.legendText}>
            Restschuld · {eurCompact(debt)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendSwatch, { backgroundColor: pdfColors.accent }]}
          />
          <Text style={styles.legendText}>
            Eigenkapital · {eurCompact(equity)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={{
              width: 2,
              height: 8,
              backgroundColor: pdfColors.text,
            }}
          />
          <Text style={styles.legendText}>
            Anschaffung · {eurCompact(acquisition)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked-Bar-Chart — zwei Serien vertikal übereinander              */
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
  if (data.length === 0) {
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

  const maxTotal = Math.max(...data.map((d) => d.series1 + d.series2), 1);

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
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
          const totalH = (total / maxTotal) * height;
          const h1 = total > 0 ? (d.series1 / total) * totalH : 0;
          const h2 = total > 0 ? (d.series2 / total) * totalH : 0;
          return (
            <View
              key={i}
              style={{ flex: 1, height, justifyContent: "flex-end" }}
            >
              <View
                style={{
                  height: totalH,
                  flexDirection: "column-reverse",
                }}
              >
                <View
                  style={{ height: h1, backgroundColor: series1Color }}
                />
                <View
                  style={{ height: h2, backgroundColor: series2Color }}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 3 }}>
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
          <View
            style={[styles.legendSwatch, { backgroundColor: series1Color }]}
          />
          <Text style={styles.legendText}>{series1Label}</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendSwatch, { backgroundColor: series2Color }]}
          />
          <Text style={styles.legendText}>{series2Label}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Simple-Bar-Chart — eine Serie, vertikal (Fälligkeiten)             */
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
  if (data.length === 0) {
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

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height,
          gap: 3,
        }}
      >
        {data.map((d, i) => {
          const h = (d.value / maxVal) * height;
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
              <Text
                style={{
                  position: "absolute",
                  top: -2,
                  left: 0,
                  right: 0,
                  fontSize: 6,
                  textAlign: "center",
                  color: pdfColors.textMuted,
                }}
              >
                {eurCompact(d.value)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 3 }}>
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

export { eurCompact };
