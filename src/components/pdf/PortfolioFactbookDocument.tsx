import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { pdfColors, pdfFontSizes, pdfSpacing } from "./pdf-theme";
import type { PdfPropertyData } from "@/lib/pdf/data";
import type { PdfLocale } from "@/lib/pdf/translate";
import { loadDict } from "@/lib/pdf/translate";

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  page: {
    padding: pdfSpacing.pagePadding,
    fontSize: pdfFontSizes.body,
    color: pdfColors.text,
    fontFamily: "Inter",
  },
  pageLandscape: {
    padding: 28,
    fontSize: 8.5,
    color: pdfColors.text,
    fontFamily: "Inter",
  },
  coverPage: {
    padding: 0,
    fontFamily: "Inter",
    color: "#FFFFFF",
    backgroundColor: pdfColors.text,
  },
  cover: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    paddingHorizontal: pdfSpacing.pagePadding,
    paddingVertical: pdfSpacing.pagePadding,
  },
  coverAccentBar: {
    width: 60,
    height: 3,
    backgroundColor: pdfColors.accent,
    marginBottom: 18,
  },
  brand: {
    fontSize: 10,
    color: pdfColors.accent,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontFamily: "Inter-Bold",
  },
  title: {
    fontSize: 38,
    fontFamily: "Inter-Bold",
    marginTop: 14,
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: pdfColors.border,
    marginTop: 10,
  },
  coverFootline: {
    position: "absolute",
    bottom: 40,
    left: pdfSpacing.pagePadding,
    right: pdfSpacing.pagePadding,
    fontSize: 9,
    color: pdfColors.border,
    borderTopWidth: 1,
    borderTopColor: pdfColors.accent,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: pdfColors.muted,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingBottom: 4,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: pdfFontSizes.pageTitle,
    fontFamily: "Inter-Bold",
    marginBottom: 8,
  },
  pageTitleLandscape: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    marginBottom: 6,
  },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 8,
    color: pdfColors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: pdfFontSizes.large,
    fontFamily: "Inter-Bold",
    marginTop: 2,
  },
  table: { flexDirection: "column", marginTop: 6 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: pdfColors.bgSubtle,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7.5,
    color: pdfColors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ownerHeader: {
    flexDirection: "row",
    backgroundColor: pdfColors.navy,
    color: "#FFFFFF",
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 9,
    fontFamily: "Inter-Bold",
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.border,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  subtotalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: pdfColors.text,
    backgroundColor: pdfColors.bgSubtle,
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontFamily: "Inter-Bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1.5,
    borderTopColor: pdfColors.accent,
    backgroundColor: pdfColors.navy,
    color: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginTop: 8,
    fontFamily: "Inter-Bold",
  },
  pageNumber: {
    position: "absolute",
    bottom: 18,
    right: 22,
    fontSize: 8,
    color: pdfColors.muted,
  },
  weightedNote: {
    fontSize: 7.5,
    color: pdfColors.muted,
    marginBottom: 4,
    fontStyle: "italic",
  },
  chartWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
    padding: 8,
  },
  chartTitle: {
    fontSize: 8,
    color: pdfColors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  // Per-property full factsheet styles (reused from FactbookDocument)
  coverImageWrap: { height: "55%", position: "relative" },
  coverImage: { width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 },
  coverImageOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: pdfColors.text,
    opacity: 0.4,
  },
  section: { marginBottom: pdfSpacing.sectionGap },
  sectionTitle: {
    fontSize: pdfFontSizes.sectionTitle,
    fontFamily: "Inter-Bold",
    color: pdfColors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingBottom: 3,
  },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  imageCell: {
    width: "32%",
    aspectRatio: 1,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: pdfColors.bgSubtle,
  },
  imageCellImg: { width: "100%", height: "100%", objectFit: "cover" },
});

// ============================================================
// HELPERS
// ============================================================
const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });

const pct = (n: number | null | undefined, fractionDigits = 2) =>
  n == null
    ? "—"
    : `${(n * 100).toLocaleString("de-DE", {
        maximumFractionDigits: fractionDigits,
      })} %`;

// Vertical bar chart drawn with primitives. data: { label, value }.
function PdfBarChart({
  data,
  title,
  formatter,
  height = 110,
  barColor = pdfColors.accent,
}: {
  data: { label: string; value: number }[];
  title: string;
  formatter?: (v: number) => string;
  height?: number;
  barColor?: string;
}) {
  if (data.length === 0) return null;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const hasNegative = data.some((d) => d.value < 0);
  const zeroY = hasNegative ? height / 2 : height;
  const barAreaHeight = hasNegative ? height / 2 : height;
  const fmt = formatter ?? ((v: number) => Math.round(v).toLocaleString("de-DE"));

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height,
          gap: 4,
        }}
      >
        {data.map((d, i) => {
          const h = (Math.abs(d.value) / maxAbs) * barAreaHeight;
          const isNeg = d.value < 0;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height,
                position: "relative",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: isNeg ? zeroY - h : height - zeroY,
                  height: h,
                  backgroundColor: isNeg ? pdfColors.negative : barColor,
                  borderRadius: 1,
                }}
              />
              <Text
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  right: 0,
                  fontSize: 6,
                  textAlign: "center",
                  color: pdfColors.text,
                }}
              >
                {fmt(d.value)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
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
            {d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// OWNER GROUPING
// ============================================================
type OwnerKey = { id: string; name: string };
type GroupedRow<T> = { ownerKey: OwnerKey; rows: T[] };

const NO_OWNER_ID = "__no_owner__";

function groupByOwner<R extends { propertyData: PdfPropertyData }>(
  rows: R[],
  noOwnerLabel: string,
  expand: (
    row: R,
    owner: { id: string; name: string; share: number }
  ) => Omit<R, "propertyData"> & {
    propertyData: PdfPropertyData;
    share: number;
    ownerName: string;
  }
): GroupedRow<
  Omit<R, "propertyData"> & {
    propertyData: PdfPropertyData;
    share: number;
    ownerName: string;
  }
>[] {
  const buckets = new Map<
    string,
    {
      key: OwnerKey;
      rows: (Omit<R, "propertyData"> & {
        propertyData: PdfPropertyData;
        share: number;
        ownerName: string;
      })[];
    }
  >();

  for (const row of rows) {
    const owners = row.propertyData.owners;
    if (owners.length === 0) {
      const key = NO_OWNER_ID;
      const expanded = expand(row, {
        id: NO_OWNER_ID,
        name: noOwnerLabel,
        share: 1,
      });
      const bucket = buckets.get(key) ?? {
        key: { id: NO_OWNER_ID, name: noOwnerLabel },
        rows: [],
      };
      bucket.rows.push(expanded);
      buckets.set(key, bucket);
    } else {
      for (const o of owners) {
        const expanded = expand(row, o);
        const bucket = buckets.get(o.id) ?? {
          key: { id: o.id, name: o.name },
          rows: [],
        };
        bucket.rows.push(expanded);
        buckets.set(o.id, bucket);
      }
    }
  }

  // Sort: known owners alphabetically; "no owner" last.
  return Array.from(buckets.values())
    .sort((a, b) => {
      if (a.key.id === NO_OWNER_ID) return 1;
      if (b.key.id === NO_OWNER_ID) return -1;
      return a.key.name.localeCompare(b.key.name);
    })
    .map((b) => ({ ownerKey: b.key, rows: b.rows }));
}

// ============================================================
// MAIN DOCUMENT
// ============================================================
export function PortfolioFactbookDocument({
  workspaceName,
  properties,
  locale,
}: {
  workspaceName: string;
  properties: PdfPropertyData[];
  locale: PdfLocale;
}) {
  const t = loadDict(locale);
  const today = new Date().toLocaleDateString(
    locale === "de" ? "de-DE" : "en-US"
  );

  // Totals + per-property balance for KPI chart
  const totals = properties.reduce(
    (acc, p) => ({
      sqm: acc.sqm + (p.property.sqm ?? 0),
      purchase: acc.purchase + (p.property.purchase_price ?? 0),
      value: acc.value + (p.latestValuation?.combined ?? 0),
      remaining: acc.remaining + p.totalRemaining,
      afterTax: acc.afterTax + (p.latestPnL?.afterTaxCashflow ?? 0),
    }),
    { sqm: 0, purchase: 0, value: 0, remaining: 0, afterTax: 0 }
  );

  return (
    <Document title={`Factbook ${workspaceName}`}>
      {/* === 1. Cover (no image) === */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.cover}>
          <View style={styles.coverAccentBar} />
          <Text style={styles.brand}>
            {t("app.name")} · {t("portfolio.title")}
          </Text>
          <Text style={styles.title}>{workspaceName}</Text>
          <Text style={styles.subtitle}>
            {properties.length} {t("portfolio.kpi_objects")} · {today}
          </Text>
        </View>
        <View style={styles.coverFootline}>
          <Text>{t("app.name")}</Text>
          <Text>{today}</Text>
        </View>
      </Page>

      {/* === 2. Portfolio KPIs + Balance Chart === */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text>{t("factsheet.key_facts")}</Text>
          <Text>{workspaceName}</Text>
        </View>
        <Text style={styles.pageTitle}>{t("portfolio.title")}</Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>{t("portfolio.kpi_objects")}</Text>
            <Text style={styles.kpiValue}>{properties.length}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>{t("portfolio.kpi_sqm")}</Text>
            <Text style={styles.kpiValue}>
              {totals.sqm.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>
              {t("portfolio.kpi_purchase_total")}
            </Text>
            <Text style={styles.kpiValue}>{eur(totals.purchase)}</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>
              {t("portfolio.kpi_value_combined")}
            </Text>
            <Text style={styles.kpiValue}>{eur(totals.value)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>
              {t("portfolio.kpi_remaining_loans")}
            </Text>
            <Text style={styles.kpiValue}>{eur(totals.remaining)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>{t("portfolio.kpi_equity")}</Text>
            <Text style={styles.kpiValue}>
              {eur(totals.value - totals.remaining)}
            </Text>
          </View>
        </View>

        <PdfBarChart
          title={t("portfolio.balance_chart_title")}
          height={130}
          data={properties.slice(0, 10).map((p) => ({
            label: shortAddress(p.property.address),
            value: (p.property.purchase_price ?? 0) - p.totalRemaining,
          }))}
          formatter={(v) =>
            (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 }) +
            "k"
          }
          barColor={pdfColors.accent}
        />

        <PageNumber />
      </Page>

      {/* === 3. Objekte (landscape) === */}
      <PropertiesByOwnerPage
        properties={properties}
        t={t}
        workspaceName={workspaceName}
      />

      {/* === 4. Cashflow (landscape) === */}
      <CashflowByOwnerPage
        properties={properties}
        t={t}
        workspaceName={workspaceName}
      />

      {/* === 5. Darlehen (landscape) === */}
      <LoansByOwnerPage
        properties={properties}
        t={t}
        workspaceName={workspaceName}
      />

      {/* === 6. Mieter (landscape) === */}
      <TenantsByOwnerPage
        properties={properties}
        t={t}
        workspaceName={workspaceName}
      />

      {/* === 7. Investitionen (landscape) === */}
      <InvestmentsByOwnerPage
        properties={properties}
        t={t}
        workspaceName={workspaceName}
      />

      {/* === Per-property full factsheets === */}
      {properties.flatMap((p) => renderPropertyPages(p, t, locale))}
    </Document>
  );
}

function shortAddress(addr: string): string {
  const firstComma = addr.indexOf(",");
  return firstComma > 0 ? addr.slice(0, firstComma) : addr;
}

function PageNumber() {
  return (
    <Text
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  );
}

// ============================================================
// LANDSCAPE PAGES
// ============================================================
type T = (key: string, params?: Record<string, string | number>) => string;

function LandscapeHeader({
  workspaceName,
  label,
}: {
  workspaceName: string;
  label: string;
}) {
  return (
    <View style={styles.pageHeader}>
      <Text>{label}</Text>
      <Text>{workspaceName}</Text>
    </View>
  );
}

function PropertiesByOwnerPage({
  properties,
  t,
  workspaceName,
}: {
  properties: PdfPropertyData[];
  t: T;
  workspaceName: string;
}) {
  const rows = properties.map((p) => ({ propertyData: p }));
  const grouped = groupByOwner(rows, t("portfolio.no_owner"), (r, o) => ({
    propertyData: r.propertyData,
    share: o.share,
    ownerName: o.name,
  }));

  let gPurchase = 0,
    gValue = 0,
    gRemaining = 0;
  for (const g of grouped)
    for (const r of g.rows) {
      gPurchase += (r.propertyData.property.purchase_price ?? 0) * r.share;
      gValue += (r.propertyData.latestValuation?.combined ?? 0) * r.share;
      gRemaining += r.propertyData.totalRemaining * r.share;
    }

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <LandscapeHeader
        workspaceName={workspaceName}
        label={t("portfolio.section_properties")}
      />
      <Text style={styles.pageTitleLandscape}>
        {t("portfolio.section_properties")}
      </Text>
      <Text style={styles.weightedNote}>{t("portfolio.weighted_note")}</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ flex: 3 }}>{t("factsheet.address")}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("portfolio.share_col")}
          </Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("properties.sqm")}
          </Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>
            {t("portfolio.kpi_purchase_total_short")}
          </Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>
            {t("valuation.combined")}
          </Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>
            {t("portfolio.kpi_remaining_loans_short")}
          </Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>
            {t("portfolio.kpi_equity_short")}
          </Text>
        </View>

        {grouped.map((g) => {
          let sPurchase = 0,
            sValue = 0,
            sRemaining = 0;
          for (const r of g.rows) {
            sPurchase += (r.propertyData.property.purchase_price ?? 0) * r.share;
            sValue += (r.propertyData.latestValuation?.combined ?? 0) * r.share;
            sRemaining += r.propertyData.totalRemaining * r.share;
          }
          return (
            <View key={g.ownerKey.id}>
              <View style={styles.ownerHeader}>
                <Text>{g.ownerKey.name}</Text>
              </View>
              {g.rows.map((r, i) => {
                const v = r.propertyData;
                const purchase = (v.property.purchase_price ?? 0) * r.share;
                const value = (v.latestValuation?.combined ?? 0) * r.share;
                const remaining = v.totalRemaining * r.share;
                return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={{ flex: 3 }}>{v.property.address}</Text>
                    <Text style={{ flex: 1, textAlign: "right" }}>
                      {pct(r.share)}
                    </Text>
                    <Text style={{ flex: 1, textAlign: "right" }}>
                      {v.property.sqm == null
                        ? "—"
                        : (v.property.sqm * r.share).toLocaleString("de-DE", {
                            maximumFractionDigits: 1,
                          })}
                    </Text>
                    <Text style={{ flex: 1.5, textAlign: "right" }}>
                      {eur(purchase)}
                    </Text>
                    <Text style={{ flex: 1.5, textAlign: "right" }}>
                      {eur(value)}
                    </Text>
                    <Text style={{ flex: 1.5, textAlign: "right" }}>
                      {eur(remaining)}
                    </Text>
                    <Text style={{ flex: 1.5, textAlign: "right" }}>
                      {eur(value - remaining)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.subtotalRow}>
                <Text style={{ flex: 3 }}>{t("portfolio.owner_subtotal")}</Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>
                  {eur(sPurchase)}
                </Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>
                  {eur(sValue)}
                </Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>
                  {eur(sRemaining)}
                </Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>
                  {eur(sValue - sRemaining)}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={styles.grandTotalRow}>
          <Text style={{ flex: 3 }}>{t("portfolio.grand_total")}</Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>{eur(gPurchase)}</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>{eur(gValue)}</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>{eur(gRemaining)}</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>
            {eur(gValue - gRemaining)}
          </Text>
        </View>
      </View>

      <PdfBarChart
        title={t("portfolio.chart_market_value")}
        height={90}
        data={properties.slice(0, 14).map((p) => ({
          label: shortAddress(p.property.address),
          value: p.latestValuation?.combined ?? 0,
        }))}
        formatter={(v) =>
          (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + "k"
        }
      />

      <PageNumber />
    </Page>
  );
}

function CashflowByOwnerPage({
  properties,
  t,
  workspaceName,
}: {
  properties: PdfPropertyData[];
  t: T;
  workspaceName: string;
}) {
  const rows = properties
    .filter((p) => p.latestPnL != null)
    .map((p) => ({ propertyData: p }));
  const grouped = groupByOwner(rows, t("portfolio.no_owner"), (r, o) => ({
    propertyData: r.propertyData,
    share: o.share,
    ownerName: o.name,
  }));

  let gRent = 0,
    gOpex = 0,
    gInterest = 0,
    gPrincipal = 0,
    gCfBT = 0,
    gCfAT = 0;
  for (const g of grouped)
    for (const r of g.rows) {
      const pnl = r.propertyData.latestPnL!;
      gRent += pnl.rentTotal * r.share;
      gOpex += pnl.operatingCosts * r.share;
      gInterest += pnl.interest * r.share;
      gPrincipal += pnl.principal * r.share;
      gCfBT += pnl.cashflowBeforeTax * r.share;
      gCfAT += pnl.afterTaxCashflow * r.share;
    }

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <LandscapeHeader
        workspaceName={workspaceName}
        label={t("portfolio.section_cashflow")}
      />
      <Text style={styles.pageTitleLandscape}>
        {t("portfolio.section_cashflow")}
      </Text>
      <Text style={styles.weightedNote}>{t("portfolio.weighted_note")}</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ flex: 3 }}>{t("factsheet.address")}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("portfolio.share_col")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("pnl.rent_total")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("pnl.operating_costs")}
          </Text>
          <Text style={{ flex: 1.2, textAlign: "right" }}>
            {t("pnl.interest")}
          </Text>
          <Text style={{ flex: 1.2, textAlign: "right" }}>
            {t("pnl.principal")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("pnl.cashflow_before_tax")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("pnl.after_tax_cashflow")}
          </Text>
        </View>

        {grouped.map((g) => {
          let sRent = 0,
            sOpex = 0,
            sInterest = 0,
            sPrincipal = 0,
            sCfBT = 0,
            sCfAT = 0;
          for (const r of g.rows) {
            const pnl = r.propertyData.latestPnL!;
            sRent += pnl.rentTotal * r.share;
            sOpex += pnl.operatingCosts * r.share;
            sInterest += pnl.interest * r.share;
            sPrincipal += pnl.principal * r.share;
            sCfBT += pnl.cashflowBeforeTax * r.share;
            sCfAT += pnl.afterTaxCashflow * r.share;
          }
          return (
            <View key={g.ownerKey.id}>
              <View style={styles.ownerHeader}>
                <Text>{g.ownerKey.name}</Text>
              </View>
              {g.rows.map((r, i) => {
                const pnl = r.propertyData.latestPnL!;
                return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={{ flex: 3 }}>
                      {r.propertyData.property.address}
                    </Text>
                    <Text style={{ flex: 1, textAlign: "right" }}>
                      {pct(r.share)}
                    </Text>
                    <Text style={{ flex: 1.4, textAlign: "right" }}>
                      {eur(pnl.rentTotal * r.share)}
                    </Text>
                    <Text style={{ flex: 1.4, textAlign: "right" }}>
                      {eur(pnl.operatingCosts * r.share)}
                    </Text>
                    <Text style={{ flex: 1.2, textAlign: "right" }}>
                      {eur(pnl.interest * r.share)}
                    </Text>
                    <Text style={{ flex: 1.2, textAlign: "right" }}>
                      {eur(pnl.principal * r.share)}
                    </Text>
                    <Text style={{ flex: 1.4, textAlign: "right" }}>
                      {eur(pnl.cashflowBeforeTax * r.share)}
                    </Text>
                    <Text style={{ flex: 1.4, textAlign: "right" }}>
                      {eur(pnl.afterTaxCashflow * r.share)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.subtotalRow}>
                <Text style={{ flex: 3 }}>{t("portfolio.owner_subtotal")}</Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(sRent)}</Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(sOpex)}</Text>
                <Text style={{ flex: 1.2, textAlign: "right" }}>
                  {eur(sInterest)}
                </Text>
                <Text style={{ flex: 1.2, textAlign: "right" }}>
                  {eur(sPrincipal)}
                </Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(sCfBT)}</Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(sCfAT)}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.grandTotalRow}>
          <Text style={{ flex: 3 }}>{t("portfolio.grand_total")}</Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(gRent)}</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(gOpex)}</Text>
          <Text style={{ flex: 1.2, textAlign: "right" }}>{eur(gInterest)}</Text>
          <Text style={{ flex: 1.2, textAlign: "right" }}>{eur(gPrincipal)}</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(gCfBT)}</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(gCfAT)}</Text>
        </View>
      </View>

      <PdfBarChart
        title={t("portfolio.chart_cashflow")}
        height={90}
        data={properties
          .filter((p) => p.latestPnL != null)
          .slice(0, 14)
          .map((p) => ({
            label: shortAddress(p.property.address),
            value: p.latestPnL!.afterTaxCashflow,
          }))}
        formatter={(v) => Math.round(v).toLocaleString("de-DE")}
      />

      <PageNumber />
    </Page>
  );
}

function LoansByOwnerPage({
  properties,
  t,
  workspaceName,
}: {
  properties: PdfPropertyData[];
  t: T;
  workspaceName: string;
}) {
  // Flatten loans, attach property for grouping.
  const loanRows: {
    propertyData: PdfPropertyData;
    loan: PdfPropertyData["loans"][number];
  }[] = [];
  for (const p of properties) {
    for (const l of p.loans) {
      loanRows.push({ propertyData: p, loan: l });
    }
  }

  const grouped = groupByOwner(loanRows, t("portfolio.no_owner"), (r, o) => ({
    propertyData: r.propertyData,
    loan: r.loan,
    share: o.share,
    ownerName: o.name,
  }));

  let gAmount = 0,
    gAnnuity = 0,
    gRemaining = 0;
  for (const g of grouped)
    for (const r of g.rows) {
      gAmount += r.loan.loan_amount * r.share;
      gAnnuity += r.loan.monthly_annuity * r.share;
      gRemaining += r.loan.remaining_balance * r.share;
    }

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <LandscapeHeader
        workspaceName={workspaceName}
        label={t("portfolio.section_loans")}
      />
      <Text style={styles.pageTitleLandscape}>
        {t("portfolio.section_loans")}
      </Text>
      <Text style={styles.weightedNote}>{t("portfolio.weighted_note")}</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ flex: 2.4 }}>{t("factsheet.address")}</Text>
          <Text style={{ flex: 1.4 }}>{t("loans.designation")}</Text>
          <Text style={{ flex: 1.2 }}>{t("loans.bank")}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("portfolio.share_col")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("loans.loan_amount")}
          </Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("loans.interest_rate_pa")}
          </Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("loans.amortization_pa")}
          </Text>
          <Text style={{ flex: 1.2, textAlign: "right" }}>
            {t("loans.annuity")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("loans.remaining_balance")}
          </Text>
        </View>

        {grouped.map((g) => {
          let sAmount = 0,
            sAnnuity = 0,
            sRemaining = 0;
          for (const r of g.rows) {
            sAmount += r.loan.loan_amount * r.share;
            sAnnuity += r.loan.monthly_annuity * r.share;
            sRemaining += r.loan.remaining_balance * r.share;
          }
          return (
            <View key={g.ownerKey.id}>
              <View style={styles.ownerHeader}>
                <Text>{g.ownerKey.name}</Text>
              </View>
              {g.rows.map((r, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ flex: 2.4 }}>
                    {r.propertyData.property.address}
                  </Text>
                  <Text style={{ flex: 1.4 }}>{r.loan.designation}</Text>
                  <Text style={{ flex: 1.2 }}>{r.loan.bank ?? "—"}</Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>
                    {pct(r.share)}
                  </Text>
                  <Text style={{ flex: 1.4, textAlign: "right" }}>
                    {eur(r.loan.loan_amount * r.share)}
                  </Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>
                    {pct(r.loan.interest_rate_pa, 3)}
                  </Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>
                    {pct(r.loan.amortization_pa, 3)}
                  </Text>
                  <Text style={{ flex: 1.2, textAlign: "right" }}>
                    {eur(r.loan.monthly_annuity * r.share)}
                  </Text>
                  <Text style={{ flex: 1.4, textAlign: "right" }}>
                    {eur(r.loan.remaining_balance * r.share)}
                  </Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={{ flex: 2.4 }}>
                  {t("portfolio.owner_subtotal")}
                </Text>
                <Text style={{ flex: 1.4 }}></Text>
                <Text style={{ flex: 1.2 }}></Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>
                  {eur(sAmount)}
                </Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1.2, textAlign: "right" }}>
                  {eur(sAnnuity)}
                </Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>
                  {eur(sRemaining)}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={styles.grandTotalRow}>
          <Text style={{ flex: 2.4 }}>{t("portfolio.grand_total")}</Text>
          <Text style={{ flex: 1.4 }}></Text>
          <Text style={{ flex: 1.2 }}></Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(gAmount)}</Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1.2, textAlign: "right" }}>{eur(gAnnuity)}</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {eur(gRemaining)}
          </Text>
        </View>
      </View>

      <PdfBarChart
        title={t("portfolio.chart_loans")}
        height={90}
        data={properties.slice(0, 14).map((p) => ({
          label: shortAddress(p.property.address),
          value: p.totalRemaining,
        }))}
        formatter={(v) =>
          (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + "k"
        }
        barColor={pdfColors.negative}
      />

      <PageNumber />
    </Page>
  );
}

function TenantsByOwnerPage({
  properties,
  t,
  workspaceName,
}: {
  properties: PdfPropertyData[];
  t: T;
  workspaceName: string;
}) {
  const rows = properties
    .filter((p) => p.tenant != null)
    .map((p) => ({ propertyData: p }));
  const grouped = groupByOwner(rows, t("portfolio.no_owner"), (r, o) => ({
    propertyData: r.propertyData,
    share: o.share,
    ownerName: o.name,
  }));

  // Try to get cold rent from latest pnl if available
  let gRent = 0;
  for (const g of grouped)
    for (const r of g.rows) {
      const pnl = r.propertyData.latestPnL;
      if (pnl) gRent += pnl.rentTotal * r.share;
    }

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <LandscapeHeader
        workspaceName={workspaceName}
        label={t("portfolio.section_tenants")}
      />
      <Text style={styles.pageTitleLandscape}>
        {t("portfolio.section_tenants")}
      </Text>
      <Text style={styles.weightedNote}>{t("portfolio.weighted_note")}</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ flex: 3 }}>{t("factsheet.address")}</Text>
          <Text style={{ flex: 2 }}>{t("tenants.name")}</Text>
          <Text style={{ flex: 1.5 }}>{t("tenants.contract_start")}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("portfolio.share_col")}
          </Text>
          <Text style={{ flex: 1.6, textAlign: "right" }}>
            {t("pnl.rent_total")}
          </Text>
        </View>

        {grouped.map((g) => {
          let sRent = 0;
          for (const r of g.rows) {
            const pnl = r.propertyData.latestPnL;
            if (pnl) sRent += pnl.rentTotal * r.share;
          }
          return (
            <View key={g.ownerKey.id}>
              <View style={styles.ownerHeader}>
                <Text>{g.ownerKey.name}</Text>
              </View>
              {g.rows.map((r, i) => {
                const tn = r.propertyData.tenant!;
                const pnl = r.propertyData.latestPnL;
                return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={{ flex: 3 }}>
                      {r.propertyData.property.address}
                    </Text>
                    <Text style={{ flex: 2 }}>{tn.name}</Text>
                    <Text style={{ flex: 1.5 }}>
                      {tn.contract_start ?? "—"}
                    </Text>
                    <Text style={{ flex: 1, textAlign: "right" }}>
                      {pct(r.share)}
                    </Text>
                    <Text style={{ flex: 1.6, textAlign: "right" }}>
                      {pnl ? eur(pnl.rentTotal * r.share) : "—"}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.subtotalRow}>
                <Text style={{ flex: 3 }}>{t("portfolio.owner_subtotal")}</Text>
                <Text style={{ flex: 2 }}></Text>
                <Text style={{ flex: 1.5 }}></Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1.6, textAlign: "right" }}>
                  {eur(sRent)}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={styles.grandTotalRow}>
          <Text style={{ flex: 3 }}>{t("portfolio.grand_total")}</Text>
          <Text style={{ flex: 2 }}></Text>
          <Text style={{ flex: 1.5 }}></Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1.6, textAlign: "right" }}>{eur(gRent)}</Text>
        </View>
      </View>

      <PdfBarChart
        title={t("portfolio.chart_cold_rent")}
        height={90}
        data={properties
          .filter((p) => p.tenant != null && p.latestPnL != null)
          .slice(0, 14)
          .map((p) => ({
            label: shortAddress(p.property.address),
            value: p.latestPnL!.rentTotal,
          }))}
        formatter={(v) =>
          (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k"
        }
      />

      <PageNumber />
    </Page>
  );
}

function InvestmentsByOwnerPage({
  properties,
  t,
  workspaceName,
}: {
  properties: PdfPropertyData[];
  t: T;
  workspaceName: string;
}) {
  const invRows: {
    propertyData: PdfPropertyData;
    inv: PdfPropertyData["investments"][number];
  }[] = [];
  for (const p of properties) {
    for (const inv of p.investments) {
      invRows.push({ propertyData: p, inv });
    }
  }
  const grouped = groupByOwner(invRows, t("portfolio.no_owner"), (r, o) => ({
    propertyData: r.propertyData,
    inv: r.inv,
    share: o.share,
    ownerName: o.name,
  }));

  let gAmount = 0;
  for (const g of grouped)
    for (const r of g.rows) gAmount += r.inv.amount * r.share;

  // For the chart: sum investments per property
  const sumByProperty = new Map<string, number>();
  for (const p of properties) {
    sumByProperty.set(
      p.property.id,
      p.investments.reduce((acc, i) => acc + i.amount, 0)
    );
  }

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <LandscapeHeader
        workspaceName={workspaceName}
        label={t("portfolio.section_investments")}
      />
      <Text style={styles.pageTitleLandscape}>
        {t("portfolio.section_investments")}
      </Text>
      <Text style={styles.weightedNote}>{t("portfolio.weighted_note")}</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ flex: 3 }}>{t("factsheet.address")}</Text>
          <Text style={{ flex: 1 }}>{t("investments.year")}</Text>
          <Text style={{ flex: 2.4 }}>{t("investments.measure_type")}</Text>
          <Text style={{ flex: 2.6 }}>{t("investments.description")}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>
            {t("portfolio.share_col")}
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>
            {t("investments.amount")}
          </Text>
        </View>

        {grouped.map((g) => {
          let sAmount = 0;
          for (const r of g.rows) sAmount += r.inv.amount * r.share;
          return (
            <View key={g.ownerKey.id}>
              <View style={styles.ownerHeader}>
                <Text>{g.ownerKey.name}</Text>
              </View>
              {g.rows.map((r, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ flex: 3 }}>
                    {r.propertyData.property.address}
                  </Text>
                  <Text style={{ flex: 1 }}>
                    {r.inv.is_long_term
                      ? t("investments.heatmap_long_term_label")
                      : r.inv.year ?? "—"}
                  </Text>
                  <Text style={{ flex: 2.4 }}>
                    {t(`investments.type_${r.inv.measure_type}`)}
                  </Text>
                  <Text style={{ flex: 2.6 }}>{r.inv.description ?? "—"}</Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>
                    {pct(r.share)}
                  </Text>
                  <Text style={{ flex: 1.4, textAlign: "right" }}>
                    {eur(r.inv.amount * r.share)}
                  </Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={{ flex: 3 }}>{t("portfolio.owner_subtotal")}</Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 2.4 }}></Text>
                <Text style={{ flex: 2.6 }}></Text>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ flex: 1.4, textAlign: "right" }}>
                  {eur(sAmount)}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={styles.grandTotalRow}>
          <Text style={{ flex: 3 }}>{t("portfolio.grand_total")}</Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 2.4 }}></Text>
          <Text style={{ flex: 2.6 }}></Text>
          <Text style={{ flex: 1 }}></Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>{eur(gAmount)}</Text>
        </View>
      </View>

      <PdfBarChart
        title={t("portfolio.chart_investments")}
        height={90}
        data={Array.from(sumByProperty.entries())
          .map(([id, v]) => ({
            label: shortAddress(
              properties.find((p) => p.property.id === id)?.property.address ??
                ""
            ),
            value: v,
          }))
          .filter((d) => d.value > 0)
          .slice(0, 14)}
        formatter={(v) =>
          (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k"
        }
      />

      <PageNumber />
    </Page>
  );
}

// ============================================================
// PER-PROPERTY FULL FACTSHEETS (portrait)
// ============================================================
function renderPropertyPages(
  data: PdfPropertyData,
  t: T,
  locale: PdfLocale
): React.ReactElement[] {
  const cover =
    data.images.find((i) => i.is_cover && i.signedUrl) ??
    data.images.find((i) => i.signedUrl);
  const dateStr = new Date().toLocaleDateString(
    locale === "de" ? "de-DE" : "en-US"
  );

  const pages: React.ReactElement[] = [];

  pages.push(
    <Page key={`${data.property.id}-cover`} size="A4" style={styles.coverPage}>
      {cover?.signedUrl ? (
        <View style={styles.coverImageWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={cover.signedUrl} style={styles.coverImage} />
          <View style={styles.coverImageOverlay} />
        </View>
      ) : null}
      <View style={styles.cover}>
        <View style={styles.coverAccentBar} />
        <Text style={styles.brand}>
          {t("app.name")} · {t("factsheet.title")}
        </Text>
        <Text style={styles.title}>{data.property.address}</Text>
        <Text style={styles.subtitle}>
          {data.property.unit_number
            ? `${t("properties.unit_number")}: ${data.property.unit_number}`
            : ""}
        </Text>
      </View>
      <View style={styles.coverFootline}>
        <Text>{t("app.name")}</Text>
        <Text>{dateStr}</Text>
      </View>
    </Page>
  );

  pages.push(
    <Page key={`${data.property.id}-kpis`} size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text>{t("factsheet.key_facts")}</Text>
        <Text>{data.property.address}</Text>
      </View>
      <Text style={styles.pageTitle}>{t("factsheet.key_facts")}</Text>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>{t("properties.sqm")}</Text>
          <Text style={styles.kpiValue}>
            {data.property.sqm == null
              ? "—"
              : data.property.sqm.toLocaleString("de-DE")}
          </Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>{t("properties.purchase_price")}</Text>
          <Text style={styles.kpiValue}>{eur(data.property.purchase_price)}</Text>
        </View>
      </View>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>{t("valuation.combined")}</Text>
          <Text style={styles.kpiValue}>
            {eur(data.latestValuation?.combined ?? null)}
          </Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>{t("loans.remaining_balance")}</Text>
          <Text style={styles.kpiValue}>{eur(data.totalRemaining)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("properties.section_owners")}</Text>
        {data.owners.length === 0 ? (
          <Text>—</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cell}>{t("tenants.name")}</Text>
              <Text style={styles.cellRight}>
                {t("properties.owners_share_sum")}
              </Text>
            </View>
            {data.owners.map((o, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>{o.name}</Text>
                <Text style={styles.cellRight}>{pct(o.share)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <PageNumber />
    </Page>
  );

  pages.push(
    <Page key={`${data.property.id}-loans`} size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text>{t("loans.title")}</Text>
        <Text>{data.property.address}</Text>
      </View>
      <Text style={styles.pageTitle}>{t("loans.title")}</Text>
      {data.loans.length === 0 ? (
        <Text>{t("loans.empty")}</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>{t("loans.designation")}</Text>
            <Text style={styles.cell}>{t("loans.bank")}</Text>
            <Text style={styles.cellRight}>{t("loans.loan_amount")}</Text>
            <Text style={styles.cellRight}>{t("loans.annuity")}</Text>
            <Text style={styles.cellRight}>{t("loans.remaining_balance")}</Text>
          </View>
          {data.loans.map((l) => (
            <View key={l.id} style={styles.tableRow}>
              <Text style={styles.cell}>{l.designation}</Text>
              <Text style={styles.cell}>{l.bank ?? "—"}</Text>
              <Text style={styles.cellRight}>{eur(l.loan_amount)}</Text>
              <Text style={styles.cellRight}>{eur(l.monthly_annuity)}</Text>
              <Text style={styles.cellRight}>{eur(l.remaining_balance)}</Text>
            </View>
          ))}
        </View>
      )}
      <PageNumber />
    </Page>
  );

  pages.push(
    <Page key={`${data.property.id}-tenant-val`} size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text>{`${t("tenants.title")} & ${t("valuation.title")}`}</Text>
        <Text>{data.property.address}</Text>
      </View>
      <Text style={styles.pageTitle}>{t("tenants.title")}</Text>
      {data.tenant ? (
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>{t("tenants.name")}</Text>
            <Text style={styles.cellRight}>{data.tenant.name}</Text>
          </View>
          {data.tenant.contract_start && (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("tenants.contract_start")}</Text>
              <Text style={styles.cellRight}>{data.tenant.contract_start}</Text>
            </View>
          )}
        </View>
      ) : (
        <Text>{t("tenants.no_tenant")}</Text>
      )}

      <View style={[styles.section, { marginTop: pdfSpacing.sectionGap }]}>
        <Text style={styles.sectionTitle}>{t("valuation.title")}</Text>
        {data.latestValuation ? (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("valuation.valuation_date")}</Text>
              <Text style={styles.cellRight}>
                {data.latestValuation.valuation_date}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("valuation.ertragswert")}</Text>
              <Text style={styles.cellRight}>
                {eur(data.latestValuation.ertragswert)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("valuation.sachwert")}</Text>
              <Text style={styles.cellRight}>
                {eur(data.latestValuation.sachwert)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cell, { fontFamily: "Inter-Bold" }]}>
                {t("valuation.combined")}
              </Text>
              <Text style={[styles.cellRight, { fontFamily: "Inter-Bold" }]}>
                {eur(data.latestValuation.combined)}
              </Text>
            </View>
          </View>
        ) : (
          <Text>{t("valuation.no_valuations")}</Text>
        )}
      </View>
      <PageNumber />
    </Page>
  );

  pages.push(
    <Page key={`${data.property.id}-pnl`} size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text>{t("pnl.title")}</Text>
        <Text>{data.property.address}</Text>
      </View>
      <Text style={styles.pageTitle}>{t("pnl.title")}</Text>
      {data.pnlSnapshots.length === 0 ? (
        <Text>{t("pnl.no_snapshots")}</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>
              {t("pnl.period_start")} – {t("pnl.period_end")}
            </Text>
            <Text style={styles.cellRight}>{t("pnl.rent_total")}</Text>
            <Text style={styles.cellRight}>{t("pnl.after_tax_cashflow")}</Text>
          </View>
          {data.pnlSnapshots.map((s, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{s.period}</Text>
              <Text style={styles.cellRight}>{eur(s.rentTotal)}</Text>
              <Text style={styles.cellRight}>{eur(s.afterTaxCashflow)}</Text>
            </View>
          ))}
        </View>
      )}
      <PageNumber />
    </Page>
  );

  pages.push(
    <Page key={`${data.property.id}-inv`} size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text>{t("investments.title")}</Text>
        <Text>{data.property.address}</Text>
      </View>
      <Text style={styles.pageTitle}>{t("investments.title")}</Text>
      {data.investments.length === 0 ? (
        <Text>{t("investments.no_investments")}</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>{t("investments.year")}</Text>
            <Text style={styles.cellRight}>{t("investments.amount")}</Text>
            <Text style={styles.cell}>{t("investments.measure_type")}</Text>
            <Text style={styles.cell}>{t("investments.description")}</Text>
          </View>
          {data.investments.map((inv, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.cell}>
                {inv.is_long_term
                  ? t("investments.heatmap_long_term_label")
                  : inv.year ?? ""}
              </Text>
              <Text style={styles.cellRight}>{eur(inv.amount)}</Text>
              <Text style={styles.cell}>
                {t(`investments.type_${inv.measure_type}`)}
              </Text>
              <Text style={styles.cell}>{inv.description ?? "—"}</Text>
            </View>
          ))}
        </View>
      )}
      <PageNumber />
    </Page>
  );

  if (data.images.filter((i) => i.signedUrl).length > 1) {
    pages.push(
      <Page key={`${data.property.id}-images`} size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text>{t("images.title")}</Text>
          <Text>{data.property.address}</Text>
        </View>
        <Text style={styles.pageTitle}>{t("images.title")}</Text>
        <View style={styles.imageGrid}>
          {data.images
            .filter((i) => i.signedUrl)
            .slice(0, 9)
            .map((img, idx) => (
              <View key={idx} style={styles.imageCell}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={img.signedUrl as string}
                  style={styles.imageCellImg}
                />
              </View>
            ))}
        </View>
        <PageNumber />
      </Page>
    );
  }

  return pages;
}
