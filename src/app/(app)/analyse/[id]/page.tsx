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
import { MarketView } from "./market-view";
import { JobStatusWidget } from "./job-status";
import { ExtraContextCard } from "./extra-context-card";
import {
  DOC_RELEVANCE,
  isPropertyType,
  type DocumentKind,
  type PropertyType,
} from "@/lib/dd/property-type";

/**
 * DD-Upload-Seite (früher „page.tsx" — jetzt auf Vorbereitung
 * beschränkt: Objektart, Exposé, weitere Docs, Marktdaten, Freifeld).
 *
 * Die eigentliche Analyse mit Score, Cockpit, Findings und Dossier-
 * Downloads lebt jetzt auf `/analyse/[id]/ergebnis` (eigene Route).
 *
 * Der CTA „Zur Analyse" oben leitet dorthin weiter, sobald mindestens
 * das Exposé extrahiert ist.
 */
export default async function DdProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  // requireUser + admin bleiben, weil die Ergebnis-Seite es braucht.
  // Hier nicht mehr verwendet, aber Auth muss durchgehen.
  await requireUser();
  void isDdAdmin;

  const supabase = await createClient();
  const project = await getDdProject(supabase, active.id, id);
  if (!project) notFound();

  // Self-Heal für Premium-User (dass sie ohne 29 € starten können).
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

  const exposeParsed = project.extracted_expose
    ? exposeExtractionSchema.safeParse(project.extracted_expose)
    : null;
  const expose = exposeParsed?.success ? exposeParsed.data : null;

  const hasExpose = docs.some((d) => d.kind === "expose");
  const pType: PropertyType = isPropertyType(project.property_type)
    ? project.property_type
    : "etw_weg";

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
        <StatusBadge status={project.status} t={t} />
      </div>

      {/* CTA: sichtbar sobald Exposé extrahiert wurde. Verlinkt zur
          Ergebnis-Seite mit Score, Cockpit, Findings, PDF-Downloads. */}
      {expose && (
        <div className="mt-6">
          <Link
            href={`/analyse/${project.id}/ergebnis`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90"
          >
            {project.score_overall != null
              ? t("dd.open_ergebnis")
              : t("dd.start_ergebnis")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {/* Sticky Job-Status-Widget während Extraction läuft */}
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

      {/* Wizard-Steps als Fortschritts-Anzeige — reduziert auf die
          Upload-Steps, da die Analyse jetzt eine eigene Seite ist. */}
      <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <Step done label={t("dd.step_project")} n={1} />
          <Step done={hasExpose} label={t("dd.step_expose")} n={2} />
          <Step done={docs.length > 1} label={t("dd.step_documents")} n={3} />
          <Step
            done={project.score_overall != null}
            label={t("dd.step_analysis")}
            n={4}
          />
        </ol>
      </div>

      {/* Freifeld für zusätzlichen Käufer-Kontext */}
      <div className="mt-6">
        <ExtraContextCard
          projectId={project.id}
          initial={project.extra_user_context ?? ""}
        />
      </div>

      {/* Schritt 1: Exposé */}
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

      {/* Schritt 2: weitere Dokumente, objektart-gefiltert */}
      {expose && (() => {
        const rel = DOC_RELEVANCE[pType];
        const allowedKinds = (
          Object.entries(rel)
            .filter(([, r]) => r !== "irrelevant")
            .map(([k]) => k) as DocumentKind[]
        );
        const recommended = (
          Object.entries(rel)
            .filter(([k, r]) => r === "recommended" && k !== "expose")
            .map(([k]) => k) as DocumentKind[]
        );
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
        return (
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              {t("dd.more_docs_section")}
            </h2>
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                {t("dd.more_docs_intro")}
              </p>
              {recommended.length > 0 && (
                <div className="mb-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2">
                  <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t("dd.recommended_for_type", {
                      type: t(`dd.ptype_${pType}`),
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recommended.map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-700 dark:text-neutral-300"
                      >
                        {t(KIND_LABEL_KEY[k])}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <DocumentUploader
                workspaceId={active.id}
                projectId={project.id}
                defaultKind={
                  (recommended[0] ?? "other") as
                    | "weg_minutes"
                    | "wirtschaftsplan"
                    | "teilungserklaerung"
                    | "energieausweis"
                    | "grundriss"
                    | "grundbuchauszug"
                    | "mieterliste"
                    | "other"
                }
                allowedKinds={
                  allowedKinds as Parameters<typeof DocumentUploader>[0]["allowedKinds"]
                }
                autoExtract
              />
            </div>
          </section>
        );
      })()}

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

      {/* Disclaimer */}
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
