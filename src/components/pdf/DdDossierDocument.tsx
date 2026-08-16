/**
 * PDF-Dossier für eine Due-Diligence-Analyse.
 *
 * Bewusst kompakt gehalten (5-8 Seiten):
 *   - Cover mit Objekt-Header + Score + Konfidenz
 *   - Findings gruppiert nach Kategorie mit Ampel + Zitat
 *   - Fragen für Termine
 *   - Verhandlungsargumente
 *   - Disclaimer
 *
 * Nutzt dieselben pdf-theme-Tokens wie Factbook — konsistentes Look.
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

type Finding = {
  category: string;
  severity: string;
  title: string;
  description: string;
  cost_min: number | null;
  cost_max: number | null;
  source_quote: string | null;
  source_location: string | null;
  confidence: number;
  next_step: string | null;
};

type CategoryScore = {
  score: number;
  ampel: "green" | "yellow" | "red";
};

type Question = {
  question: string;
  addressed_to: string;
  priority: string;
};

type NegotiationArg = {
  argument: string;
  preisabschlag_eur_min: number | null;
  preisabschlag_eur_max: number | null;
};

export type DdDossierData = {
  projectName: string;
  addressLine: string;
  purchasePriceEur: number | null;
  livingAreaSqm: number | null;
  scoreOverall: number | null;
  scoreConfidence: number | null;
  scoreByCategory: Record<string, CategoryScore>;
  findings: Finding[];
  questions: Question[];
  negotiationArgs: NegotiationArg[];
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
  scoreRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 14,
  },
  scoreBox: {
    borderWidth: 1,
    borderColor: pdfColors.border,
    padding: 10,
    borderRadius: 4,
    minWidth: 100,
  },
  scoreLabel: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginTop: 3,
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
  categoryHeader: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  findingCard: {
    padding: 8,
    borderLeftWidth: 3,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  findingTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
  },
  findingBody: {
    fontSize: 9,
    color: pdfColors.text,
    lineHeight: 1.4,
  },
  findingMeta: {
    fontSize: 8,
    color: pdfColors.textMuted,
    marginTop: 3,
    fontStyle: "italic",
  },
  costBadge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
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
  questionItem: {
    marginBottom: 4,
    fontSize: 9.5,
    lineHeight: 1.4,
  },
  argItem: {
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

const AMPEL_COLOR: Record<string, string> = {
  green: "#059669",
  yellow: "#D97706",
  red: "#DC2626",
};

const SEVERITY_COLOR: Record<string, string> = {
  high: "#DC2626",
  medium: "#D97706",
  low: pdfColors.textMuted,
  positive: "#059669",
};

const CATEGORY_ORDER = [
  "substanz",
  "finanzierung",
  "recht",
  "weg",
  "energie",
  "markt",
  "lage",
];

const CATEGORY_LABEL: Record<string, string> = {
  substanz: "Substanz & Sanierungsbedarf",
  finanzierung: "Finanzierung & Nebenkosten",
  recht: "Recht & Vertrag",
  weg: "Eigentümergemeinschaft",
  energie: "Energie / GEG",
  markt: "Preis & Markt",
  lage: "Lage",
};

function eur(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
function eurFromNum(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function DdDossierDocument({ data }: { data: DdDossierData }) {
  const findingsByCategory = new Map<string, Finding[]>();
  for (const f of data.findings) {
    const list = findingsByCategory.get(f.category) ?? [];
    list.push(f);
    findingsByCategory.set(f.category, list);
  }

  return (
    <Document
      title={`Due-Diligence: ${data.projectName}`}
      author="Estateably"
      creator="Estateably"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.brand}>Estateably · Due-Diligence-Dossier</Text>
          <Text style={styles.title}>{data.projectName}</Text>
          <Text style={styles.subtitle}>{data.addressLine || "—"}</Text>
        </View>

        {/* Score */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Gesamt-Score</Text>
            <Text
              style={[
                styles.scoreValue,
                {
                  color:
                    (data.scoreOverall ?? 0) >= 65
                      ? AMPEL_COLOR.green
                      : (data.scoreOverall ?? 0) >= 40
                        ? AMPEL_COLOR.yellow
                        : AMPEL_COLOR.red,
                },
              ]}
            >
              {data.scoreOverall ?? "—"}/100
            </Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Konfidenz</Text>
            <Text style={styles.scoreValue}>
              {data.scoreConfidence != null
                ? Math.round(data.scoreConfidence * 100) + "%"
                : "—"}
            </Text>
          </View>
          {data.purchasePriceEur != null && (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>Angebot</Text>
              <Text style={styles.scoreValue}>
                {eurFromNum(data.purchasePriceEur)}
              </Text>
            </View>
          )}
          {data.livingAreaSqm != null && data.purchasePriceEur != null && (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>€/m²</Text>
              <Text style={styles.scoreValue}>
                {Math.round(
                  data.purchasePriceEur / data.livingAreaSqm
                ).toLocaleString("de-DE")}
              </Text>
            </View>
          )}
        </View>

        {/* Findings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bewertung nach Kategorie</Text>
          {CATEGORY_ORDER.filter(
            (c) => (findingsByCategory.get(c)?.length ?? 0) > 0
          ).map((cat) => {
            const cs = data.scoreByCategory[cat];
            return (
              <View key={cat}>
                <Text style={styles.categoryHeader}>
                  {CATEGORY_LABEL[cat] ?? cat}
                  {cs ? `  ·  ${Math.round(cs.score)}/100` : ""}
                </Text>
                {findingsByCategory.get(cat)?.map((f, i) => (
                  <View
                    key={i}
                    style={[
                      styles.findingCard,
                      {
                        borderLeftColor:
                          SEVERITY_COLOR[f.severity] ?? pdfColors.textMuted,
                      },
                    ]}
                    wrap={false}
                  >
                    <Text style={styles.findingTitle}>{f.title}</Text>
                    <Text style={styles.findingBody}>{f.description}</Text>
                    {(f.cost_min != null || f.cost_max != null) && (
                      <Text style={styles.costBadge}>
                        Kosten:{" "}
                        {f.cost_min != null && f.cost_max != null
                          ? `${eur(f.cost_min)} – ${eur(f.cost_max)}`
                          : f.cost_min != null
                            ? `ab ${eur(f.cost_min)}`
                            : `bis ${eur(f.cost_max!)}`}
                      </Text>
                    )}
                    {f.source_quote && (
                      <View style={styles.quoteBlock}>
                        <Text>
                          „{f.source_quote}"
                          {f.source_location ? ` (${f.source_location})` : ""}
                        </Text>
                      </View>
                    )}
                    {f.next_step && (
                      <Text style={styles.findingMeta}>→ {f.next_step}</Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* Fragen */}
        {data.questions.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Fragen für den Termin</Text>
            {data.questions.map((q, i) => (
              <Text key={i} style={styles.questionItem}>
                • {q.question}
              </Text>
            ))}
          </View>
        )}

        {/* Verhandlungs-Argumente */}
        {data.negotiationArgs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verhandlungsargumente</Text>
            {data.negotiationArgs.map((a, i) => (
              <View key={i} style={styles.argItem} wrap={false}>
                <Text>{a.argument}</Text>
                {(a.preisabschlag_eur_min != null ||
                  a.preisabschlag_eur_max != null) && (
                  <Text style={styles.findingMeta}>
                    Begründeter Preisabschlag:{" "}
                    {a.preisabschlag_eur_min != null &&
                    a.preisabschlag_eur_max != null
                      ? `${eurFromNum(a.preisabschlag_eur_min)} – ${eurFromNum(a.preisabschlag_eur_max)}`
                      : a.preisabschlag_eur_min != null
                        ? `ab ${eurFromNum(a.preisabschlag_eur_min)}`
                        : `bis ${eurFromNum(a.preisabschlag_eur_max!)}`}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text>
            Hinweis: Dieses Dossier ist eine Entscheidungshilfe auf Basis von
            hochgeladenen Dokumenten und öffentlichen Marktdaten. Es ersetzt
            KEIN Wertgutachten, KEINE Rechts- oder Bauberatung und KEINE
            Finanzierungszusage. Vor Vertragsunterzeichnung eigene
            Fachleute (Anwalt, Bausachverständiger, Bank) einbeziehen.
            Erstellt am {new Date(data.computedAt).toLocaleDateString("de-DE")}.
          </Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Estateably · Due-Diligence · ${data.projectName} · Seite ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
