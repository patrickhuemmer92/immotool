import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDdProject } from "@/lib/dd/projects";
import type { DdProjectNote } from "@/lib/dd/notes";
import { requireUser } from "@/lib/auth";
import { isDdAdmin } from "@/lib/dd/admin";
import { getPremiumStatus } from "@/lib/billing/premium";
import { exposeExtractionSchema } from "@/lib/dd/schemas/expose";
import { AcquisitionCard } from "../acquisition-card";
import { AnalysisPreview } from "../analysis-preview";
import { DdPaywall } from "../paywall";
import { DecisionActions } from "../decision-actions";
import { ScoreGauge } from "./score-gauge";
import { CategoryCard } from "./category-card";
import { AnalyzeButton } from "./analyze-button";
import { NotesLog } from "../notes-log";
import {
  DOC_RELEVANCE,
  isPropertyType,
  type DocumentKind,
  type PropertyType,
} from "@/lib/dd/property-type";

const CATEGORIES = [
  "substanz",
  "finanzierung",
  "recht",
  "weg",
  "energie",
  "markt",
  "lage",
] as const;

const KIND_LABEL_KEY: Record<DocumentKind, string> = {
  expose: "dd.doc_kind_expose",
  weg_minutes: "dd.doc_kind_weg",
  wirtschaftsplan: "dd.doc_kind_budget",
  teilungserklaerung: "dd.doc_kind_teilung",
  energieausweis: "dd.doc_kind_energie",
  grundriss: "dd.doc_kind_grundriss",
  grundbuchauszug: "dd.doc_kind_grundbuch",
  mieterliste: "dd.doc_kind_mieterliste",
  other: "dd.doc_kind_other",
};

/**
 * DD-Analyse-Ergebnis-Seite — eigene Route, getrennt vom Upload.
 *
 * Aufbau (top-down):
 *   1. Header + KI-Analyse-Button (ganz oben)
 *   2. Tacho (Score) + Konfidenz-Halbkreis
 *   3. Doku-Checkliste für die gewählte Objektart
 *   4. Objektdetails (Exposé-Kernfelder + Kaufnebenkosten + Rendite)
 *   5. Kategorie-Cards — kollabierbar, default zu
 */
export default async function DdErgebnisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  const user = await requireUser();
  const isAdmin = isDdAdmin(user.email);

  const supabase = await createClient();
  const project = await getDdProject(supabase, active.id, id);
  if (!project) notFound();

  // Self-Heal für Premium-User (analog zur Upload-Seite)
  if (!project.paid) {
    const premium = await getPremiumStatus(active.id);
    if (premium.hasPaidSubscription) {
      await supabase
        .from("dd_projects")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: `PREMIUM_UNLOCK_${active.id.slice(0, 8)}_${Date.now()}`,
        })
        .eq("id", project.id);
      project.paid = true;
    }
  }

  const { data: docs } = await supabase
    .from("dd_documents")
    .select("id, kind, ocr_status")
    .eq("dd_project_id", project.id);
  const uploadedKinds = (docs ?? [])
    .filter((d) => d.ocr_status === "extracted")
    .map((d) => d.kind as DocumentKind);

  const exposeParsed = project.extracted_expose
    ? exposeExtractionSchema.safeParse(project.extracted_expose)
    : null;
  const expose = exposeParsed?.success ? exposeParsed.data : null;

  const { data: findings } = await supabase
    .from("dd_findings")
    .select(
      "id, category, severity, title, description, cost_min, cost_max, cost_horizon, source_quote, source_location, source_market, confidence, confidence_reason, next_step"
    )
    .eq("dd_project_id", project.id)
    .order("severity", { ascending: false });

  const { data: noteRows } = await supabase
    .from("dd_project_notes")
    .select("id, occurred_on, source, note, created_at")
    .eq("dd_project_id", project.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  const notes = (noteRows ?? []) as DdProjectNote[];

  const pType: PropertyType = isPropertyType(project.property_type)
    ? project.property_type
    : "etw_weg";
  const rel = DOC_RELEVANCE[pType];
  const relevantDocs = (Object.entries(rel)
    .filter(([, r]) => r === "required" || r === "recommended")
    .map(([k]) => k) as DocumentKind[]);
  const uploadedSet = new Set(uploadedKinds);
  const docsCoveredCount = relevantDocs.filter((k) => uploadedSet.has(k)).length;

  const scoreCat = (project.score_by_category ?? {}) as Record<string, {
    score: number;
    ampel: "green" | "yellow" | "red";
    count_high?: number;
    count_medium?: number;
  }>;

  const findingsByCategory = new Map<string, typeof findings>();
  for (const f of findings ?? []) {
    const list = findingsByCategory.get(f.category) ?? [];
    list.push(f);
    findingsByCategory.set(f.category, list);
  }

  const scoreConf = project.score_confidence == null
    ? null
    : Number(project.score_confidence);

  return (
    <div>
      {/* Zurück-Link zur Upload-Seite */}
      <Link
        href={`/analyse/${project.id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("dd.back_to_upload")}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dd.ergebnis_title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {project.name}
            {project.address_hint ? ` · ${project.address_hint}` : ""}
          </p>
        </div>
        {project.score_overall != null && (
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/api/pdf/dd-dossier/${project.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title={t("dd.download_internal_hint")}
            >
              {t("dd.download_internal")}
            </a>
            <a
              href={`/api/pdf/dd-external-dossier/${project.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title={t("dd.download_external_hint")}
            >
              {t("dd.download_external")}
            </a>
          </div>
        )}
      </div>

      {/* Neue Erkenntnisse erfassen und Analyse darauf neu rechnen.
          Beides gehört zusammen: was nach einem Besichtigungstermin
          oder Telefonat dazukommt, steht in keinem Dokument — und ohne
          erneuten Lauf ändert es am Ergebnis nichts. Die Card gibt es
          auch auf der Upload-Seite, dort für den Kontext VOR der
          ersten Analyse. */}
      {expose && project.paid && (
        <div className="mt-6 space-y-4">
          <NotesLog projectId={project.id} notes={notes} />
          <AnalyzeButton
            projectId={project.id}
            hasScore={project.score_overall != null}
            hasEnoughData={!!expose}
          />
        </div>
      )}

      {/* Paywall + Preview wenn noch nicht bezahlt */}
      {expose && !project.paid && (
        <>
          <div className="mt-6">
            <AnalysisPreview />
          </div>
          <DdPaywall
            projectId={project.id}
            docs={(docs ?? []).map((d) => ({
              kind: d.kind as string,
              ocr_status: d.ocr_status as string,
            }))}
            isAdmin={isAdmin}
          />
        </>
      )}

      {/* Score + Konfidenz + Doku-Coverage */}
      {project.score_overall != null && (
        <section className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            {/* Tacho mit Nadel */}
            <div className="flex flex-col items-center">
              <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                {t("dd.cockpit_score")}
              </div>
              <ScoreGauge value={project.score_overall} size={220} />
            </div>

            {/* Konfidenz + Doku-Coverage */}
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("dd.cockpit_confidence")}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">
                    {scoreConf != null
                      ? Math.round(scoreConf * 100) + " %"
                      : "—"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${Math.round((scoreConf ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {t("dd.cockpit_confidence_hint")}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("dd.cockpit_docs")}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">
                    {docsCoveredCount}
                  </span>
                  <span className="text-sm text-neutral-500">
                    / {relevantDocs.length}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      docsCoveredCount / Math.max(1, relevantDocs.length) >= 0.8
                        ? "bg-green-500"
                        : docsCoveredCount / Math.max(1, relevantDocs.length) >= 0.5
                          ? "bg-amber-500"
                          : "bg-neutral-400"
                    }`}
                    style={{
                      width: `${(docsCoveredCount / Math.max(1, relevantDocs.length)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Doku-Checklist Pills */}
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                {t("dd.cockpit_checklist_title")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {relevantDocs.map((k) => {
                  const uploaded = uploadedSet.has(k);
                  return (
                    <span
                      key={k}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                        uploaded
                          ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300"
                          : "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
                      }`}
                    >
                      <span>{uploaded ? "✓" : "○"}</span>
                      <span>{t(KIND_LABEL_KEY[k])}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Objektdetails aus Exposé + Kaufnebenkosten + Rendite */}
      {expose && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("dd.ergebnis_object_details")}
          </h2>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <DetailField label={t("dd.field_address")} value={
                [expose.street, [expose.postal_code, expose.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ") || "—"
              } />
              <DetailField
                label={t("dd.expose_purchase_price")}
                value={
                  expose.purchase_price_eur != null
                    ? expose.purchase_price_eur.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })
                    : "—"
                }
              />
              <DetailField
                label={t("dd.expose_living_area")}
                value={expose.living_area_sqm != null ? `${expose.living_area_sqm} m²` : "—"}
              />
              <DetailField
                label={t("dd.expose_build_year")}
                value={expose.build_year != null ? String(expose.build_year) : "—"}
              />
              {expose.energy_class && (
                <DetailField
                  label={t("dd.expose_energy_class")}
                  value={expose.energy_class}
                />
              )}
              {expose.rooms != null && (
                <DetailField
                  label={t("dd.expose_rooms")}
                  value={String(expose.rooms)}
                />
              )}
              {expose.hoa_fee_per_month_eur != null && (
                <DetailField
                  label={t("dd.expose_hoa_fee")}
                  value={
                    expose.hoa_fee_per_month_eur.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }) + " /Mo"
                  }
                />
              )}
              {expose.current_cold_rent_per_month_eur != null && (
                <DetailField
                  label={t("dd.expose_cold_rent")}
                  value={
                    expose.current_cold_rent_per_month_eur.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }) + " /Mo"
                  }
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Kaufnebenkosten + Bruttorendite */}
      {expose && expose.purchase_price_eur != null && (
        <section className="mt-6">
          <AcquisitionCard expose={expose} />
        </section>
      )}

      {/* Kategorie-Cards — aufklappbar, default zu */}
      {project.paid && (findings?.length ?? 0) > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t("dd.ergebnis_findings")}
          </h2>
          {CATEGORIES.filter((c) => (findingsByCategory.get(c)?.length ?? 0) > 0).map(
            (cat) => (
              <CategoryCard
                key={cat}
                categoryKey={cat}
                findings={(findingsByCategory.get(cat) ?? []) as Parameters<typeof CategoryCard>[0]["findings"]}
                score={scoreCat[cat] ?? null}
              />
            )
          )}
        </section>
      )}

      {/* Fragen + Verhandlungs-Argumente (nur intern-Ansicht) */}
      {project.paid && (
        <MetaSection scoreByCategory={project.score_by_category} />
      )}

      {/* Entscheidung: Watchlist / Kaufen */}
      {expose && project.score_overall != null && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("dd.decision_section")}
          </h2>
          <DecisionActions
            projectId={project.id}
            status={project.status}
            promotedPropertyId={project.promoted_to_property_id}
          />
        </section>
      )}

      {/* Disclaimer */}
      <div className="mt-8 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
        <strong className="font-semibold">{t("dd.disclaimer_title")}:</strong>{" "}
        {t("dd.disclaimer_body")}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

async function MetaSection({
  scoreByCategory,
}: {
  scoreByCategory: unknown;
}) {
  const t = await getTranslations();
  const meta = (scoreByCategory as { _meta?: unknown } | null)?._meta as
    | {
        questions?: Array<{
          question: string;
          addressed_to: string;
          priority: string;
        }>;
        negotiation_arguments?: Array<{
          argument: string;
          preisabschlag_eur_min: number | null;
          preisabschlag_eur_max: number | null;
        }>;
      }
    | undefined;
  if (!meta) return null;

  return (
    <>
      {(meta.questions ?? []).length > 0 && (
        <section className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h3 className="text-sm font-semibold mb-3">
            {t("dd.questions_title")}
          </h3>
          <ul className="space-y-2">
            {(meta.questions ?? []).map((q, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full mt-2 shrink-0 ${
                    q.priority === "high"
                      ? "bg-red-500"
                      : q.priority === "medium"
                        ? "bg-amber-500"
                        : "bg-neutral-400"
                  }`}
                />
                <div className="flex-1">
                  <p>{q.question}</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t(`dd.addressed_${q.addressed_to}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(meta.negotiation_arguments ?? []).length > 0 && (
        <section className="mt-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h3 className="text-sm font-semibold mb-3">
            {t("dd.negotiation_title")}
          </h3>
          <ul className="space-y-3">
            {(meta.negotiation_arguments ?? []).map((a, i) => (
              <li key={i} className="text-sm border-l-2 border-accent pl-3">
                <p>{a.argument}</p>
                {(a.preisabschlag_eur_min != null || a.preisabschlag_eur_max != null) && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {t("dd.negotiation_reduction")}:{" "}
                    {fmtRange(a.preisabschlag_eur_min, a.preisabschlag_eur_max)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function fmtRange(min: number | null, max: number | null): string {
  const fmt = (v: number) =>
    v.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `ab ${fmt(min)}`;
  if (max != null) return `bis ${fmt(max)}`;
  return "—";
}
