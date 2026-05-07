import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors, pdfFontSizes, pdfSpacing } from "./pdf-theme";
import type { PdfPropertyData } from "@/lib/pdf/data";
import type { PdfLocale } from "@/lib/pdf/translate";
import { loadDict } from "@/lib/pdf/translate";

const styles = StyleSheet.create({
  page: {
    padding: pdfSpacing.pagePadding,
    fontSize: pdfFontSizes.body,
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
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: pdfFontSizes.pageTitle,
    fontFamily: "Inter-Bold",
    marginBottom: 12,
  },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: pdfSpacing.sectionGap },
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
  table: { flexDirection: "column", marginTop: pdfSpacing.sectionGap },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: pdfColors.bgSubtle,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8,
    color: pdfColors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cell: { flex: 2 },
  cellRight: { flex: 1, textAlign: "right" },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: pdfSpacing.pagePadding,
    fontSize: 8,
    color: pdfColors.muted,
  },
  propertyHeading: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    marginBottom: 4,
    marginTop: 12,
  },
  smallTable: { marginTop: 4 },
});

const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });

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
      {/* Cover */}
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

      {/* Portfolio KPIs */}
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
              {totals.sqm.toLocaleString("de-DE", {
                maximumFractionDigits: 0,
              })}
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
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>{t("properties.title")}</Text>
            <Text style={styles.cellRight}>{t("valuation.combined")}</Text>
            <Text style={styles.cellRight}>{t("loans.remaining_balance")}</Text>
            <Text style={styles.cellRight}>{t("portfolio.kpi_equity")}</Text>
          </View>
          {properties.map((p) => (
            <View key={p.property.id} style={styles.tableRow}>
              <Text style={styles.cell}>{p.property.address}</Text>
              <Text style={styles.cellRight}>
                {eur(p.latestValuation?.combined ?? null)}
              </Text>
              <Text style={styles.cellRight}>{eur(p.totalRemaining)}</Text>
              <Text style={styles.cellRight}>
                {p.latestValuation?.combined != null
                  ? eur(p.latestValuation.combined - p.totalRemaining)
                  : "—"}
              </Text>
            </View>
          ))}
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>

      {/* One mini-page per property */}
      {properties.map((p) => (
        <Page key={p.property.id} size="A4" style={styles.page}>
          <View style={styles.pageHeader}>
            <Text>{t("properties.title")}</Text>
            <Text>{p.property.address}</Text>
          </View>
          <Text style={styles.propertyHeading}>{p.property.address}</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>{t("properties.sqm")}</Text>
              <Text style={styles.kpiValue}>
                {p.property.sqm == null
                  ? "—"
                  : p.property.sqm.toLocaleString("de-DE")}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>
                {t("properties.purchase_price")}
              </Text>
              <Text style={styles.kpiValue}>
                {eur(p.property.purchase_price)}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>{t("valuation.combined")}</Text>
              <Text style={styles.kpiValue}>
                {eur(p.latestValuation?.combined ?? null)}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>
                {t("loans.remaining_balance")}
              </Text>
              <Text style={styles.kpiValue}>{eur(p.totalRemaining)}</Text>
            </View>
          </View>

          <View style={styles.smallTable}>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("factsheet.tenant_summary")}</Text>
              <Text style={styles.cellRight}>
                {p.tenant ? p.tenant.name : t("tenants.no_tenant")}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("loans.title")}</Text>
              <Text style={styles.cellRight}>{p.loans.length}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("pnl.after_tax_cashflow")}</Text>
              <Text style={styles.cellRight}>
                {p.latestPnL ? eur(p.latestPnL.afterTaxCashflow) : "—"}
              </Text>
            </View>
          </View>

          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}
