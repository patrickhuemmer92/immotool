/**
 * Externes „öffentliches" Objektdossier — die Version, die dem
 * Verkäufer / Makler vorgelegt werden kann.
 *
 * Unterschied zum internen Verhandlungsdossier:
 *   - Neutraler Sachverständigen-Ton (kein „kritisch", keine
 *     Preisdrücker-Argumente)
 *   - Fakten-Bulletlist statt Findings mit Ampel-Bewertung
 *   - „Prüfung empfohlen" / „Datenlage lückenhaft" statt „Mangel"
 *   - Keine Verhandlungs-Argumente-Sektion
 *   - Statt Kostenschätzungen: offene Prüfpunkte
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import "./pdf-theme";
import { pdfColors, pdfSpacing } from "./pdf-theme";
import type { ExternalDossierData } from "@/lib/dd/schemas/external-dossier";

export type DdExternalDossierPdfData = {
  projectName: string;
  addressLine: string;
  purchasePriceEur: number | null;
  livingAreaSqm: number | null;
  dossier: ExternalDossierData;
  computedAt: string;
};

const styles = StyleSheet.create({
  page: {
    padding: pdfSpacing.pagePadding,
    backgroundColor: pdfColors.bg,
    color: pdfColors.text,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: pdfSpacing.sectionGap,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  brand: {
    fontSize: 9,
    color: pdfColors.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.navy,
  },
  subtitle: {
    fontSize: 11,
    color: pdfColors.textMuted,
    marginTop: 3,
  },
  summary: {
    marginTop: 14,
    fontSize: 10.5,
    lineHeight: 1.5,
    color: pdfColors.text,
  },
  section: {
    marginTop: pdfSpacing.sectionGap,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: pdfColors.navy,
  },
  factRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.border,
    paddingVertical: 5,
  },
  factLabel: {
    width: 150,
    fontSize: 10,
    color: pdfColors.textMuted,
  },
  factValue: {
    fontSize: 10,
    flex: 1,
  },
  factNote: {
    fontSize: 8,
    color: pdfColors.textMuted,
    fontStyle: "italic",
  },
  assessmentCard: {
    padding: 8,
    borderLeftWidth: 3,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  assessmentCat: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  assessmentTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  assessmentBody: {
    fontSize: 9,
    color: pdfColors.text,
    lineHeight: 1.4,
  },
  quoteBlock: {
    marginTop: 4,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: pdfColors.textMuted,
    fontSize: 8,
    color: pdfColors.textMuted,
    fontStyle: "italic",
  },
  openItem: {
    marginBottom: 6,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: pdfColors.accent,
    fontSize: 9.5,
    lineHeight: 1.4,
  },
  disclaimer: {
    marginTop: pdfSpacing.sectionGap,
    padding: 8,
    borderWidth: 1,
    borderColor: pdfColors.border,
    fontSize: 8,
    color: pdfColors.textMuted,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: pdfSpacing.pagePadding,
    right: pdfSpacing.pagePadding,
    fontSize: 7,
    color: pdfColors.textMuted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
});

const STATUS_COLOR: Record<string, string> = {
  unauffaellig: "#059669",
  pruefung_empfohlen: "#D97706",
  unklarheit: "#6B7280", // grau, nicht rot — bewusst zurückhaltend
};

const CATEGORY_LABEL: Record<string, string> = {
  substanz: "Substanz & Bauzustand",
  finanzierung: "Wirtschaftliche Kennzahlen",
  recht: "Recht & Vertragsdokumente",
  weg: "Eigentümergemeinschaft",
  energie: "Energetische Situation",
  markt: "Markteinordnung",
  lage: "Standort & Lage",
};

function eurFromNum(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function DdExternalDossierDocument({
  data,
}: {
  data: DdExternalDossierPdfData;
}) {
  const d = data.dossier;

  return (
    <Document
      title={`Objektdossier: ${data.projectName}`}
      author="Estateably"
      creator="Estateably"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>Objektdossier</Text>
          <Text style={styles.title}>{data.projectName}</Text>
          <Text style={styles.subtitle}>{data.addressLine || "—"}</Text>
        </View>

        {/* Objektive Zusammenfassung */}
        <Text style={styles.summary}>{d.objective_summary}</Text>

        {/* Key Facts */}
        {d.key_facts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kennzahlen im Überblick</Text>
            {d.key_facts.map((f, i) => (
              <View key={i} style={styles.factRow} wrap={false}>
                <Text style={styles.factLabel}>{f.label}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.factValue}>{f.value}</Text>
                  {f.note && <Text style={styles.factNote}>{f.note}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sachliche Bewertungen */}
        {d.assessments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sachliche Einordnung</Text>
            {d.assessments.map((a, i) => (
              <View
                key={i}
                style={[
                  styles.assessmentCard,
                  { borderLeftColor: STATUS_COLOR[a.status] ?? pdfColors.textMuted },
                ]}
                wrap={false}
              >
                <Text style={styles.assessmentCat}>
                  {CATEGORY_LABEL[a.category] ?? a.category}
                </Text>
                {/* Status-Badge bewusst weggelassen — für die externe
                    Version wollen wir keine „Prüfung empfohlen"-Chips.
                    Die Bewertungsfarbe (borderLeftColor) reicht als
                    subtiler Ampel-Anker. */}
                <Text style={styles.assessmentTitle}>{a.one_liner}</Text>
                {a.details && (
                  <Text style={styles.assessmentBody}>{a.details}</Text>
                )}
                {a.source_quote && (
                  <View style={styles.quoteBlock}>
                    <Text>
                      „{a.source_quote}"
                      {a.source_location ? ` (${a.source_location})` : ""}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Marktkontext */}
        {d.market_context?.benchmark_note && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Markteinordnung</Text>
            <Text style={styles.assessmentBody}>
              {d.market_context.benchmark_note}
              {d.market_context.price_per_sqm_eur != null && (
                <>
                  {" "}
                  (Kaufpreis pro m²:{" "}
                  {eurFromNum(d.market_context.price_per_sqm_eur)})
                </>
              )}
            </Text>
          </View>
        )}

        {/* Offene Punkte */}
        {d.open_items.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Offene Punkte / Dokumente</Text>
            {d.open_items.map((o, i) => (
              <View key={i} style={styles.openItem} wrap={false}>
                {/* Priorität bewusst weggelassen — nicht für externe
                    Vorlage geeignet („niedrige Priorität" signalisiert
                    dem Verkäufer, was der Käufer nachrangig behandelt). */}
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>
                  {o.topic}
                </Text>
                <Text style={{ fontSize: 9, marginTop: 2 }}>
                  {o.why_relevant}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Neutrale Disclaimer */}
        <View style={styles.disclaimer}>
          <Text>
            Dieses Dossier fasst die vom Käufer bereitgestellten Unterlagen
            zusammen und benennt offene Prüfpunkte in neutraler Form.
            Es ist keine gutachterliche Wertermittlung und ersetzt keine
            fachliche Beratung durch Anwalt, Sachverständigen oder Bank.
            Erstellt am {new Date(data.computedAt).toLocaleDateString("de-DE")}.
          </Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Objektdossier · ${data.projectName} · Seite ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
