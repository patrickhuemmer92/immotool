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
  coverPage: {
    padding: 0,
    fontFamily: "Inter",
    color: "#FFFFFF",
    backgroundColor: pdfColors.text,
  },
  coverImageWrap: {
    height: "55%",
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.65,
  },
  coverImageOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: pdfColors.text,
    opacity: 0.4,
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
  coverBrand: {
    fontSize: 10,
    color: pdfColors.accent,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontFamily: "Inter-Bold",
  },
  coverTitle: {
    fontSize: 38,
    fontFamily: "Inter-Bold",
    marginTop: 14,
    color: "#FFFFFF",
  },
  coverSubtitle: {
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
  section: {
    marginBottom: pdfSpacing.sectionGap,
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
  table: {
    flexDirection: "column",
  },
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
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: pdfSpacing.pagePadding,
    fontSize: 8,
    color: pdfColors.muted,
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
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  imageCell: {
    width: "32%",
    aspectRatio: 1,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: pdfColors.bgSubtle,
  },
  imageCellImg: { width: "100%", height: "100%", objectFit: "cover" },
  imageCaption: {
    fontSize: 8,
    color: pdfColors.muted,
    marginTop: 2,
    textAlign: "center",
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

function PageHeader({ data, label }: { data: PdfPropertyData; label: string }) {
  return (
    <View style={styles.pageHeader}>
      <Text>{label}</Text>
      <Text>{data.property.address}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <Text
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  );
}

export function FactbookDocument({
  data,
  locale,
}: {
  data: PdfPropertyData;
  locale: PdfLocale;
}) {
  const t = loadDict(locale);
  const cover = data.images.find((i) => i.signedUrl);
  const today = new Date().toLocaleDateString(
    locale === "de" ? "de-DE" : "en-US"
  );

  return (
    <Document title={`Factbook ${data.property.address}`}>
      {/* Page 1 — Cover */}
      <Page size="A4" style={styles.coverPage}>
        {cover?.signedUrl ? (
          <View style={styles.coverImageWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={cover.signedUrl} style={styles.coverImage} />
            <View style={styles.coverImageOverlay} />
          </View>
        ) : null}
        <View style={styles.cover}>
          <View style={styles.coverAccentBar} />
          <Text style={styles.coverBrand}>
            {t("app.name")} · {t("factsheet.title")}
          </Text>
          <Text style={styles.coverTitle}>{data.property.address}</Text>
          <Text style={styles.coverSubtitle}>
            {data.property.unit_number
              ? `${t("properties.unit_number")}: ${data.property.unit_number}`
              : ""}
          </Text>
        </View>
        <View style={styles.coverFootline}>
          <Text>{t("app.name")}</Text>
          <Text>{today}</Text>
        </View>
      </Page>

      {/* Page 2 — KPIs + Owners */}
      <Page size="A4" style={styles.page}>
        <PageHeader data={data} label={t("factsheet.key_facts")} />
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
            <Text style={styles.kpiValue}>
              {eur(data.property.purchase_price)}
            </Text>
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
                <Text style={styles.cell}>{t("owners.name")}</Text>
                <Text style={styles.cellRight}>
                  {t("properties.owners_share_sum")}
                </Text>
              </View>
              {data.owners.map((o, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.cell}>{o.name}</Text>
                  <Text style={styles.cellRight}>
                    {(o.share * 100).toLocaleString("de-DE", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    %
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <PageFooter />
      </Page>

      {/* Page 3 — Loans */}
      <Page size="A4" style={styles.page}>
        <PageHeader data={data} label={t("loans.title")} />
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
        <PageFooter />
      </Page>

      {/* Page 4 — Tenant + Valuation */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          data={data}
          label={`${t("tenants.title")} & ${t("valuation.title")}`}
        />
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
            <View style={styles.tableRow}>
              <Text style={styles.cell}>{t("tenants.score")}</Text>
              <Text style={styles.cellRight}>
                {data.tenant.score == null
                  ? "—"
                  : data.tenant.score.toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 2,
                    })}
              </Text>
            </View>
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
                <Text
                  style={[styles.cell, { fontFamily: "Inter-Bold" }]}
                >
                  {t("valuation.combined")}
                </Text>
                <Text
                  style={[
                    styles.cellRight,
                    { fontFamily: "Inter-Bold" },
                  ]}
                >
                  {eur(data.latestValuation.combined)}
                </Text>
              </View>
            </View>
          ) : (
            <Text>{t("valuation.no_valuations")}</Text>
          )}
        </View>
        <PageFooter />
      </Page>

      {/* Page 5 — PnL Snapshots */}
      <Page size="A4" style={styles.page}>
        <PageHeader data={data} label={t("pnl.title")} />
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
        <PageFooter />
      </Page>

      {/* Page 6 — Investments */}
      <Page size="A4" style={styles.page}>
        <PageHeader data={data} label={t("investments.title")} />
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
            {data.investments.map((i, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.cell}>
                  {i.is_long_term
                    ? t("investments.heatmap_long_term_label")
                    : i.year ?? ""}
                </Text>
                <Text style={styles.cellRight}>{eur(i.amount)}</Text>
                <Text style={styles.cell}>
                  {t(`investments.type_${i.measure_type}`)}
                </Text>
                <Text style={styles.cell}>{i.description ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}
        <PageFooter />
      </Page>

      {/* Page 7 (optional) — Image gallery, only if more than cover */}
      {data.images.filter((i) => i.signedUrl).length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader data={data} label={t("images.title")} />
          <Text style={styles.pageTitle}>{t("images.title")}</Text>
          <View style={styles.imageGrid}>
            {data.images
              .filter((i) => i.signedUrl)
              .slice(0, 9)
              .map((img, idx) => (
                <View key={idx} style={styles.imageCell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={img.signedUrl as string} style={styles.imageCellImg} />
                </View>
              ))}
          </View>
          <PageFooter />
        </Page>
      )}
    </Document>
  );
}
