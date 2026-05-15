import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
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
  header: {
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.accent,
    paddingBottom: 12,
    marginBottom: 14,
  },
  brand: {
    fontSize: pdfFontSizes.small,
    color: pdfColors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: pdfFontSizes.pageTitle,
    fontFamily: "Inter-Bold",
    marginTop: 4,
  },
  subtitle: {
    fontSize: pdfFontSizes.small,
    color: pdfColors.muted,
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: pdfSpacing.sectionGap,
  },
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
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  section: {
    marginTop: pdfSpacing.sectionGap,
  },
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  label: { color: pdfColors.muted },
  value: { fontFamily: "Inter-Bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: pdfSpacing.pagePadding,
    right: pdfSpacing.pagePadding,
    fontSize: 8,
    color: pdfColors.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
  cover: {
    width: "100%",
    height: 160,
    objectFit: "cover",
    marginBottom: pdfSpacing.sectionGap,
    borderRadius: 4,
  },
});

const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });

export function FactsheetDocument({
  data,
  locale,
}: {
  data: PdfPropertyData;
  locale: PdfLocale;
}) {
  const t = loadDict(locale);
  const cover =
    data.images.find((i) => i.is_cover && i.signedUrl) ??
    data.images.find((i) => i.signedUrl);

  return (
    <Document title={`Factsheet ${data.property.address}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{t("app.name")} · {t("factsheet.title")}</Text>
          <Text style={styles.title}>{data.property.address}</Text>
          {data.property.unit_number ? (
            <Text style={styles.subtitle}>
              {t("properties.unit_number")}: {data.property.unit_number}
            </Text>
          ) : null}
        </View>

        {cover?.signedUrl && (
          /* eslint-disable-next-line jsx-a11y/alt-text */
          <Image src={cover.signedUrl} style={styles.cover} />
        )}

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

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("properties.section_owners")}
              </Text>
              {data.owners.length === 0 ? (
                <Text style={styles.label}>—</Text>
              ) : (
                data.owners.map((o, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.label}>{o.name}</Text>
                    <Text style={styles.value}>
                      {(o.share * 100).toLocaleString("de-DE", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      %
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("factsheet.tenant_summary")}
              </Text>
              {data.tenant ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("tenants.name")}</Text>
                    <Text style={styles.value}>{data.tenant.name}</Text>
                  </View>
                  {data.tenant.contract_start && (
                    <View style={styles.row}>
                      <Text style={styles.label}>{t("tenants.contract_start")}</Text>
                      <Text style={styles.value}>
                        {data.tenant.contract_start}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.label}>{t("tenants.no_tenant")}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("factsheet.latest_valuation")}
              </Text>
              {data.latestValuation ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("valuation.valuation_date")}</Text>
                    <Text style={styles.value}>
                      {data.latestValuation.valuation_date}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("valuation.ertragswert")}</Text>
                    <Text style={styles.value}>
                      {eur(data.latestValuation.ertragswert)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("valuation.sachwert")}</Text>
                    <Text style={styles.value}>
                      {eur(data.latestValuation.sachwert)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("valuation.combined")}</Text>
                    <Text style={styles.value}>
                      {eur(data.latestValuation.combined)}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.label}>—</Text>
              )}
            </View>
          </View>

          <View style={styles.col}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("factsheet.loans_summary")}
              </Text>
              {data.loans.length === 0 ? (
                <Text style={styles.label}>—</Text>
              ) : (
                data.loans.map((l) => (
                  <View key={l.id} style={styles.row}>
                    <Text style={styles.label}>{l.designation}</Text>
                    <Text style={styles.value}>
                      {eur(l.remaining_balance)}
                    </Text>
                  </View>
                ))
              )}
              {data.loans.length > 0 && (
                <View style={[styles.row, { marginTop: 4 }]}>
                  <Text style={[styles.label, { fontFamily: "Inter-Bold" }]}>
                    {t("loans.annuity")}
                  </Text>
                  <Text style={styles.value}>{eur(data.totalAnnuity)}/M</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("factsheet.latest_pnl")}
              </Text>
              {data.latestPnL ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>
                      {t("pnl.period_start")} – {t("pnl.period_end")}
                    </Text>
                    <Text style={styles.value}>{data.latestPnL.period}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("pnl.rent_total")}</Text>
                    <Text style={styles.value}>
                      {eur(data.latestPnL.rentTotal)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("pnl.operating_costs")}</Text>
                    <Text style={styles.value}>
                      {eur(-data.latestPnL.operatingCosts)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("pnl.interest")}</Text>
                    <Text style={styles.value}>
                      {eur(-data.latestPnL.interest)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{t("pnl.cashflow_before_tax")}</Text>
                    <Text style={styles.value}>
                      {eur(data.latestPnL.cashflowBeforeTax)}
                    </Text>
                  </View>
                  <View style={[styles.row, { marginTop: 4 }]}>
                    <Text style={[styles.label, { fontFamily: "Inter-Bold" }]}>
                      {t("pnl.after_tax_cashflow")}
                    </Text>
                    <Text style={styles.value}>
                      {eur(data.latestPnL.afterTaxCashflow)}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.label}>{t("pnl.no_snapshots")}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{t("app.name")}</Text>
          <Text>
            {new Date().toLocaleDateString(locale === "de" ? "de-DE" : "en-US")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
