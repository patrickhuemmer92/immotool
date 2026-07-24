import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDdProject } from "@/lib/dd/projects";
import { requireUser } from "@/lib/auth";
import { isDdAdmin } from "@/lib/dd/admin";
import { getPremiumStatus } from "@/lib/billing/premium";
import { exposeExtractionSchema } from "@/lib/dd/schemas/expose";
import { DocumentUploader } from "./document-uploader";
import { ExposeEditor } from "./expose-editor";
import { DdDocumentList } from "./document-list";
import { FindingsView } from "./findings-view";
import { MarketView } from "./market-view";
import { DecisionActions } from "./decision-actions";
import { DdPaywall } from "./paywall";
import { JobStatusWidget } from "./job-status";
import { AcquisitionCard } from "./acquisition-card";
import { AnalysisPreview } from "./analysis-preview";

export default async function DdProjectPage({
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

  // Self-Heal für bestehende DD-Projekte: wenn der User Premium hat
  // aber das Projekt noch nicht paid ist, schalten wir es hier direkt
  // frei. Verhindert dass alte Projekte (angelegt vor dem Premium-
  // Bypass-Fix) für Premium-User weiterhin die Paywall zeigen.
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

  const { data: docsRaw } = await supabase
    .from("dd_documents")
    .select(
      "id, kind, filename, mime_type, size_bytes, ocr_status, ocr_error, extracted_at, uploaded_at"
    )
    .eq("dd_project_id", project.id)
    .order("uploaded_at", { ascending: false });
  const docs = docsRaw ?? [];

  // Sicheres Parsing des Extraction-JSONs — Migration schreibt `unknown`,
  // wir validieren im Server damit die UI-Component saubere Typen sieht.
  const exposeParsed = project.extracted_expose
    ? exposeExtractionSchema.safeParse(project.extracted_expose)
    : null;
  const expose = exposeParsed?.success ? exposeParsed.data : null;

  const hasExpose = docs.some((d) => d.kind === "expose");

  // Findings + Score-Meta laden — nur wenn schon eine Analyse gelaufen ist.
  const { data: findings } = await supabase
    .from("dd_findings")
    .select(
      "id, category, severity, title, description, cost_min, cost_max, cost_horizon, source_quote, source_location, source_market, confidence, confidence_reason, next_step"
    )
    .eq("dd_project_id", project.id)
    .order("severity", { ascending: false });

  return (
    <div>
      <Link
        href="/analyse"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("dd.title")}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {project.address_hint && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {project.address_hint}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project.score_overall != null && (
            <a
              href={`/api/pdf/dd-dossier/${project.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t("dd.download_dossier")}
            </a>
          )}
          <StatusBadge status={project.status} t={t} />
        </div>
      </div>

      {/* Job-Status-Widget — sticky, damit es beim Scrollen sichtbar bleibt
          wenn User weiter unten neue Dokumente hochlädt. `sticky top-4`
          klebt es 16px unter dem Viewport-Rand fest, sobald der User
          runterscrollt. */}
      {docs.some((d) => d.ocr_status === "pending") && (
        <div className="mt-6 sticky top-4 z-40">
          <JobStatusWidget
            projectId={project.id}
            initialDocs={docs.map((d) => ({
              id: d.id,
              ocr_status: d.ocr_status,
            }))}
          />
        </div>
      )}

      {/* Wizard-Steps als Fortschritts-Anzeige */}
      <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <Step done label={t("dd.step_project")} n={1} />
          <Step done={hasExpose} label={t("dd.step_expose")} n={2} />
          <Step
            done={docs.length > 1}
            label={t("dd.step_documents")}
            n={3}
          />
          <Step
            done={project.score_overall != null}
            label={t("dd.step_analysis")}
            n={4}
          />
          <Step
            done={project.status === "watchlist" || project.status === "promoted"}
            label={t("dd.step_decision")}
            n={5}
          />
        </ol>
      </div>

      {/* Schritt 2: Exposé-Upload — oder Extraktion-Preview + Edit */}
      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          {t("dd.expose_section")}
        </h2>
        {!expose ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              {t("dd.expose_upload_intro")}
            </p>
            <DocumentUploader
              workspaceId={active.id}
              projectId={project.id}
              defaultKind="expose"
              autoExtract
            />
          </div>
        ) : (
          <ExposeEditor projectId={project.id} expose={expose} />
        )}
      </section>

      {/* Kaufnebenkosten + Bruttorendite — nur wenn Kaufpreis bekannt */}
      {expose && expose.purchase_price_eur != null && (
        <section className="mt-6">
          <AcquisitionCard expose={expose} />
        </section>
      )}

      {/* Schritt 3: Weitere Dokumente — erst nach Exposé sinnvoll */}
      {expose && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("dd.more_docs_section")}
          </h2>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
              {t("dd.more_docs_intro")}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              {t("dd.more_docs_hint_phase3")}
            </p>
            <DocumentUploader
              workspaceId={active.id}
              projectId={project.id}
              defaultKind="weg_minutes"
              autoExtract
            />
          </div>
        </section>
      )}

      {/* Marktdaten */}
      {expose && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("dd.market_section")}
          </h2>
          <MarketView
            projectId={project.id}
            snapshot={
              project.market_snapshot as Parameters<
                typeof MarketView
              >[0]["snapshot"]
            }
            canFetch={!!(expose.city || expose.postal_code)}
          />
        </section>
      )}

      {/* Paywall + Preview — wenn noch nicht bezahlt.
          Placeholder-Preview zeigt die grobe Struktur der Analyse
          (rein generic, kein echter Content). Modal-Overlay mit
          backdrop-blur liegt darüber — visueller Anreiz, aber
          per CSS nicht umgehbar, weil die echten Findings sowieso
          nur bei paid=true vom Server gerendert werden. */}
      {expose && !project.paid && (
        <>
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              {t("dd.analysis_section")}
            </h2>
            <AnalysisPreview />
          </section>
          <DdPaywall
            projectId={project.id}
            docs={docs.map((d) => ({
              kind: d.kind as string,
              ocr_status: d.ocr_status,
            }))}
            isAdmin={isAdmin}
          />
        </>
      )}

      {/* Schritt 4: Analyse + Findings — nur nach Zahlung */}
      {expose && project.paid && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("dd.analysis_section")}
          </h2>
          <FindingsView
            projectId={project.id}
            scoreOverall={project.score_overall}
            scoreConfidence={project.score_confidence}
            scoreByCategory={
              project.score_by_category as Parameters<
                typeof FindingsView
              >[0]["scoreByCategory"]
            }
            findings={(findings ?? []) as Parameters<typeof FindingsView>[0]["findings"]}
            hasEnoughDataForAnalysis={!!expose}
          />
        </section>
      )}

      {/* Schritt 5: Entscheidung — nur nach Analyse */}
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

      {/* Doku-Liste */}
      {docs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("dd.documents_section")}
          </h2>
          <DdDocumentList
            projectId={project.id}
            docs={docs.map((d) => ({
              id: d.id,
              kind: d.kind as string,
              filename: d.filename,
              size_bytes: d.size_bytes,
              ocr_status: d.ocr_status,
              ocr_error: d.ocr_error,
              extracted_at: d.extracted_at,
              uploaded_at: d.uploaded_at,
            }))}
          />
        </section>
      )}

      {/* Disclaimer — dauerhaft sichtbar */}
      <div className="mt-8 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
        <strong className="font-semibold">{t("dd.disclaimer_title")}:</strong>{" "}
        {t("dd.disclaimer_body")}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const color =
    status === "watchlist"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
      : status === "promoted"
        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
        : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}
    >
      {t(`dd.status_${status}`)}
    </span>
  );
}

function Step({
  done,
  label,
  n,
}: {
  done: boolean;
  label: string;
  n: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
          done
            ? "bg-accent text-accent-foreground"
            : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span
        className={
          done
            ? "text-neutral-900 dark:text-neutral-100 font-medium"
            : "text-neutral-500 dark:text-neutral-400"
        }
      >
        {label}
      </span>
    </li>
  );
}
