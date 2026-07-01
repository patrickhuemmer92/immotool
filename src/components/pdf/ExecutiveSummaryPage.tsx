import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors } from "./pdf-theme";
import type { PdfPropertyData } from "@/lib/pdf/data";
import type { PdfLocale } from "@/lib/pdf/translate";
import { loadDict } from "@/lib/pdf/translate";
import {
  PdfCapitalStackBar,
  PdfSimpleBarChart,
  PdfStackedBarChart,
  PdfTenancyTimeline,
  PdfWaterfallChart,
  eurCompact,
  type StackedRow,
  type TenancyRow,
  type WaterfallPosition,
} from "./pdf-charts";

/**
 * Executive Summary — verdichtete Erst-Sicht direkt nach dem Cover.
 * Landscape.
 *
 * Aufbau:
 *   Header + KPI-Streifen (5 Kacheln)
 *   Capital-Stack-Hero (Full-Width Bar)
 *   3-Spalten-Grid:  Darlehensfälligkeiten · Investitionsplan · Mieter-Timeline
 *   Full-Width:      Cashflow-Waterfall
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
    marginBottom: 10,
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
    marginBottom: 10,
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
    padding: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    fontFamily: "Inter-SemiBold",
  },
  chartGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  chartCell: { flex: 1 },
  fullWidthChart: {
    // volle Chart-Zeile für den Waterfall
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
  loanMaturities: Array<{ label: string; value: number }>;
  investmentPlan: StackedRow[];
  tenancyRows: TenancyRow[];
  waterfall: WaterfallPosition[];
  hasCashflowData: boolean;
};

function aggregate(
  properties: PdfPropertyData[],
  todayIso: string
): Aggregates {
  let marketValue = 0;
  let purchase = 0;
  let ancillary = 0;
  let remainingDebt = 0;

  const maturityMap = new Map<number, number>();
  const investmentMap = new Map<
    number,
    { sicher: number; eventuell: number }
  >();

  // Waterfall-Positionen aggregieren
  let sumRent = 0;
  let sumOperating = 0;
  let sumInterest = 0;
  let sumPrincipal = 0;
  let sumTax = 0;
  let sumAfterTax = 0;
  let cashflowSamples = 0;

  const tenancyRows: TenancyRow[] = [];
  const currentYear = new Date(todayIso).getUTCFullYear();

  for (const p of properties) {
    marketValue += p.latestValuation?.combined ?? 0;
    purchase += p.property.purchase_price ?? 0;
    ancillary += p.property.ancillaryCostsTotal;
    remainingDebt += p.totalRemaining;

    for (const l of p.loans) {
      if (!l.rate_lock_until || l.remaining_at_rate_lock == null) continue;
      const y = new Date(l.rate_lock_until).getUTCFullYear();
      maturityMap.set(y, (maturityMap.get(y) ?? 0) + l.remaining_at_rate_lock);
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

    if (p.latestPnL) {
      sumRent += p.latestPnL.rentTotal;
      sumOperating += p.latestPnL.operatingCosts;
      sumInterest += p.latestPnL.interest;
      sumPrincipal += p.latestPnL.principal;
      sumTax += p.latestPnL.taxEffect;
      sumAfterTax += p.latestPnL.afterTaxCashflow;
      cashflowSamples++;
    }

    if (p.tenant?.contract_start) {
      // contract_start ist bereits per dateDe() umgeformt ("dd.mm.yyyy").
      // Wir brauchen es wieder in ISO für das Sortieren + Rendering.
      // Konservativ: entweder ISO oder DE-Format erkennen.
      const iso = normalizeToIso(p.tenant.contract_start);
      const endIso = p.tenant.contract_end
        ? normalizeToIso(p.tenant.contract_end)
        : null;
      if (iso) {
        const isActive =
          !p.tenant.is_fixed_term || !endIso || endIso >= todayIso;
        tenancyRows.push({
          label: shortLabel(p.property.address),
          contractStart: iso,
          contractEnd: endIso,
          isActive,
        });
      }
    }
  }

  const loanMaturities = Array.from(maturityMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 8)
    .map(([year, val]) => ({ label: String(year), value: val }));

  const investmentPlan = Array.from(investmentMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 6)
    .map(([year, v]) => ({
      label: String(year),
      series1: v.sicher,
      series2: v.eventuell,
    }));

  tenancyRows.sort((a, b) => a.contractStart.localeCompare(b.contractStart));
  // Max 7 sichtbare Zeilen — sonst wird's im PDF zu eng
  tenancyRows.splice(7);

  const equity = Math.max(0, marketValue - remainingDebt);
  const acquisitionInclAncillary = purchase + ancillary;

  // Waterfall — nur wenn wir mindestens einen Cashflow-Snapshot haben.
  // rentTotal ist im Snapshot i. d. R. jährlich normalisiert; wir zeigen
  // die Summe über alle Objekte (Portfolio p. a., basierend auf dem
  // jeweils jüngsten Snapshot je Objekt).
  const waterfall: WaterfallPosition[] = [];
  if (cashflowSamples > 0) {
    waterfall.push({
      label: "Bruttomiete",
      value: Math.round(sumRent),
      kind: "start",
    });
    if (sumOperating > 0)
      waterfall.push({
        label: "Betriebskosten",
        value: -Math.round(sumOperating),
        kind: "delta",
      });
    if (sumInterest > 0)
      waterfall.push({
        label: "Zinsen",
        value: -Math.round(sumInterest),
        kind: "delta",
      });
    if (sumPrincipal > 0)
      waterfall.push({
        label: "Tilgung",
        value: -Math.round(sumPrincipal),
        kind: "delta",
      });
    if (Math.abs(sumTax) > 0.5)
      waterfall.push({
        label: sumTax >= 0 ? "Steuer" : "Steuer-Erstattung",
        value: -Math.round(sumTax),
        kind: "delta",
      });
    waterfall.push({
      label: "CF n. Steuer",
      value: Math.round(sumAfterTax),
      kind: "end",
    });
  }

  return {
    propertiesCount: properties.length,
    marketValue,
    acquisitionInclAncillary,
    remainingDebt,
    equity,
    ltvPct: marketValue > 0 ? (remainingDebt / marketValue) * 100 : null,
    loanMaturities,
    investmentPlan,
    tenancyRows,
    waterfall,
    hasCashflowData: cashflowSamples > 0,
  };
}

function shortLabel(address: string): string {
  const first = address.split(",")[0]?.trim() ?? address;
  if (first.length <= 16) return first;
  return first.slice(0, 15) + "…";
}

/**
 * Der PdfPropertyData-Loader wandelt Daten manchmal in „dd.mm.yyyy" um
 * (siehe dateDe). Wir müssen für die Timeline wieder ISO haben.
 */
function normalizeToIso(dateStr: string): string | null {
  if (!dateStr) return null;
  // ISO-Format „yyyy-mm-dd"
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  // Deutsches Format „dd.mm.yyyy"
  const de = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2]}-${de[1]}`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Page-Komponente                                                    */
/* ------------------------------------------------------------------ */

export function ExecutiveSummaryPage({
  workspaceName,
  properties,
  locale,
  today,
  todayIso,
}: {
  workspaceName: string;
  properties: PdfPropertyData[];
  locale: PdfLocale;
  today: string;
  todayIso: string;
}) {
  const t = loadDict(locale);
  const agg = aggregate(properties, todayIso);
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

      {/* 3-Spalten-Chart-Grid — Darlehen · Invest · Mieter-Timeline */}
      <View style={styles.chartGrid}>
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
        <View style={styles.chartCell}>
          <PdfTenancyTimeline
            title="Mieterstruktur — vermietet seit"
            data={agg.tenancyRows}
            todayIso={todayIso}
          />
        </View>
      </View>

      {/* Waterfall — volle Breite */}
      <View style={styles.fullWidthChart}>
        <PdfWaterfallChart
          title="Cashflow-Waterfall (Portfolio, p. a.)"
          data={agg.waterfall}
        />
      </View>

      <View style={styles.footer}>
        <Text>{t("app.name")}</Text>
        <Text>Executive Summary</Text>
      </View>
    </Page>
  );
}
