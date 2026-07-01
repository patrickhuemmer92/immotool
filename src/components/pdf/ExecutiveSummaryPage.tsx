import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors } from "./pdf-theme";
import type { PdfPropertyData } from "@/lib/pdf/data";
import type { PdfLocale } from "@/lib/pdf/translate";
import { loadDict } from "@/lib/pdf/translate";
import {
  PdfCapitalStackBar,
  PdfSimpleBarChart,
  PdfStackedBarChart,
  eurCompact,
  type StackedRow,
} from "./pdf-charts";

/**
 * Executive Summary — verdichtete Erst-Sicht direkt nach dem Cover.
 * Ein Blick, alle Kernaussagen: Kapitalstruktur (Debt/Equity),
 * Objekt-Bilanzen, Refi-Landschaft und Investitionsplan.
 *
 * Landscape, weil KPI-Streifen + Hero + 3-Spalten-Chart-Grid horizontal
 * mehr Luft haben.
 */

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8.5,
    color: pdfColors.text,
    fontFamily: "Inter",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingBottom: 6,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "column" },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: pdfColors.text,
    letterSpacing: -0.3,
  },
  headerEyebrow: {
    fontSize: 8,
    color: pdfColors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: "Inter-SemiBold",
    marginBottom: 2,
  },
  headerRight: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textAlign: "right",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#FFFFFF",
  },
  kpiAccent: {
    borderColor: pdfColors.accent,
    backgroundColor: "#F0FDFB",
  },
  kpiLabel: {
    fontSize: 7,
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: pdfColors.text,
    letterSpacing: -0.4,
  },
  kpiValueAccent: {
    color: pdfColors.accent,
  },
  kpiSub: {
    fontSize: 7,
    color: pdfColors.textMuted,
    marginTop: 2,
  },
  heroBox: {
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    fontFamily: "Inter-SemiBold",
  },
  heroValue: {
    fontSize: 10,
    color: pdfColors.text,
    marginBottom: 8,
  },
  chartGrid: {
    flexDirection: "row",
    gap: 8,
  },
  chartCell: {
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: pdfColors.textMuted,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 4,
  },
});

/* ------------------------------------------------------------------ */
/*  Aggregation                                                        */
/* ------------------------------------------------------------------ */

type Aggregates = {
  propertiesCount: number;
  marketValue: number;
  acquisitionInclAncillary: number;
  remainingDebt: number;
  equity: number;
  ltvPct: number | null;
  capitalByProperty: StackedRow[];
  loanMaturities: Array<{ label: string; value: number }>;
  investmentPlan: StackedRow[];
};

function aggregate(properties: PdfPropertyData[]): Aggregates {
  let marketValue = 0;
  let purchase = 0;
  let ancillary = 0;
  let remainingDebt = 0;

  const capitalByProperty: StackedRow[] = [];
  const maturityMap = new Map<number, number>();
  const investmentMap = new Map<
    number,
    { sicher: number; eventuell: number }
  >();

  const currentYear = new Date().getUTCFullYear();

  for (const p of properties) {
    const mv = p.latestValuation?.combined ?? 0;
    const rd = p.totalRemaining;
    marketValue += mv;
    purchase += p.property.purchase_price ?? 0;
    ancillary += p.property.ancillaryCostsTotal;
    remainingDebt += rd;

    if (mv > 0) {
      capitalByProperty.push({
        label: shortLabel(p.property.address),
        series1: rd, // Restschuld
        series2: Math.max(0, mv - rd), // Eigenkapital
      });
    }

    for (const l of p.loans) {
      if (!l.rate_lock_until || l.remaining_at_rate_lock == null) continue;
      const y = new Date(l.rate_lock_until).getUTCFullYear();
      maturityMap.set(
        y,
        (maturityMap.get(y) ?? 0) + l.remaining_at_rate_lock
      );
    }

    for (const inv of p.investments) {
      const year =
        inv.is_long_term || inv.year == null ? currentYear + 1 : inv.year;
      if (year < currentYear) continue;
      const isSicher = inv.measure_type.startsWith("fixed_");
      const cur = investmentMap.get(year) ?? { sicher: 0, eventuell: 0 };
      if (isSicher) cur.sicher += inv.amount;
      else cur.eventuell += inv.amount;
      investmentMap.set(year, cur);
    }
  }

  // Top 8 nach Marktwert-Anteil — Landscape-Bars vertragen nicht mehr.
  capitalByProperty.sort(
    (a, b) => b.series1 + b.series2 - (a.series1 + a.series2)
  );
  capitalByProperty.splice(8);

  const loanMaturities = Array.from(maturityMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 8)
    .map(([year, val]) => ({ label: String(year), value: val }));

  const investmentPlan: StackedRow[] = Array.from(investmentMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 6)
    .map(([year, v]) => ({
      label: String(year),
      series1: v.sicher,
      series2: v.eventuell,
    }));

  const equity = Math.max(0, marketValue - remainingDebt);
  const acquisitionInclAncillary = purchase + ancillary;

  return {
    propertiesCount: properties.length,
    marketValue,
    acquisitionInclAncillary,
    remainingDebt,
    equity,
    ltvPct: marketValue > 0 ? (remainingDebt / marketValue) * 100 : null,
    capitalByProperty,
    loanMaturities,
    investmentPlan,
  };
}

function shortLabel(address: string): string {
  // Erste Zeile der Adresse (bis zum Komma) und dann nur die Straße
  // plus Hausnummer — Details wie PLZ ballern die X-Achse voll.
  const first = address.split(",")[0]?.trim() ?? address;
  if (first.length <= 16) return first;
  return first.slice(0, 15) + "…";
}

/* ------------------------------------------------------------------ */
/*  Page-Komponente                                                    */
/* ------------------------------------------------------------------ */

export function ExecutiveSummaryPage({
  workspaceName,
  properties,
  locale,
  today,
}: {
  workspaceName: string;
  properties: PdfPropertyData[];
  locale: PdfLocale;
  today: string;
}) {
  const t = loadDict(locale);
  const agg = aggregate(properties);
  const ltvLabel =
    agg.ltvPct == null
      ? "—"
      : `${agg.ltvPct.toLocaleString("de-DE", {
          maximumFractionDigits: 1,
        })} %`;

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEyebrow}>Executive Summary</Text>
          <Text style={styles.headerTitle}>{workspaceName}</Text>
        </View>
        <View>
          <Text style={styles.headerRight}>
            {t("app.name")} · {t("portfolio.title")}
          </Text>
          <Text style={styles.headerRight}>Stichtag {today}</Text>
        </View>
      </View>

      {/* KPI-Streifen */}
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>{t("portfolio.kpi_objects")}</Text>
          <Text style={styles.kpiValue}>{agg.propertiesCount}</Text>
          <Text style={styles.kpiSub}>im Bestand</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>
            {t("portfolio.kpi_value_combined")}
          </Text>
          <Text style={styles.kpiValue}>{eurCompact(agg.marketValue)}</Text>
          <Text style={styles.kpiSub}>
            Anschaffung {eurCompact(agg.acquisitionInclAncillary)}
          </Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>
            {t("portfolio.kpi_remaining_loans")}
          </Text>
          <Text style={styles.kpiValue}>{eurCompact(agg.remainingDebt)}</Text>
          <Text style={styles.kpiSub}>Bank-Restschuld heute</Text>
        </View>
        <View style={[styles.kpi, styles.kpiAccent]}>
          <Text style={styles.kpiLabel}>{t("portfolio.kpi_equity")}</Text>
          <Text style={[styles.kpiValue, styles.kpiValueAccent]}>
            {eurCompact(agg.equity)}
          </Text>
          <Text style={styles.kpiSub}>Marktwert − Restschuld</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>{t("portfolio.kpi_ltv")}</Text>
          <Text style={styles.kpiValue}>{ltvLabel}</Text>
          <Text style={styles.kpiSub}>Beleihungsauslauf</Text>
        </View>
      </View>

      {/* Capital-Stack-Hero */}
      <View style={styles.heroBox}>
        <Text style={styles.heroLabel}>Kapitalstruktur des Portfolios</Text>
        <PdfCapitalStackBar
          debt={agg.remainingDebt}
          equity={agg.equity}
          acquisition={agg.acquisitionInclAncillary}
        />
      </View>

      {/* 3-Spalten-Chart-Grid */}
      <View style={styles.chartGrid}>
        <View style={styles.chartCell}>
          <PdfStackedBarChart
            title="Kapital je Objekt"
            data={agg.capitalByProperty}
            series1Label="Restschuld"
            series2Label="Eigenkapital"
            series1Color={pdfColors.muted}
            series2Color={pdfColors.accent}
          />
        </View>
        <View style={styles.chartCell}>
          <PdfSimpleBarChart
            title="Darlehensfälligkeiten (Zinsbindung)"
            data={agg.loanMaturities}
            barColor={pdfColors.muted}
          />
        </View>
        <View style={styles.chartCell}>
          <PdfStackedBarChart
            title="Investitionsplan"
            data={agg.investmentPlan}
            series1Label="Sicher"
            series2Label="Eventuell"
            series1Color={pdfColors.accent}
            series2Color={pdfColors.accentLight}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text>{t("app.name")}</Text>
        <Text>Executive Summary</Text>
      </View>
    </Page>
  );
}
