import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { listDdProjects, type DdProject } from "@/lib/dd/projects";

export default async function AnalysePage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const projects = await listDdProjects(supabase, active.id);

  const watchlist = projects.filter((p) => p.status === "watchlist");
  const others = projects.filter((p) => p.status !== "watchlist");

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dd.title")}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
            {t("dd.intro")}
          </p>
        </div>
        <Link
          href="/analyse/neu"
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          + {t("dd.new")}
        </Link>
      </div>

      {watchlist.length > 0 && (
        <Section title={t("dd.watchlist_section")}>
          <ProjectGrid projects={watchlist} t={t} />
        </Section>
      )}

      <Section
        title={
          watchlist.length > 0 ? t("dd.analyses_section") : t("dd.all_projects")
        }
      >
        {others.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("dd.empty")}
          </p>
        ) : (
          <ProjectGrid projects={others} t={t} />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function ProjectGrid({
  projects,
  t,
}: {
  projects: DdProject[];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/analyse/${p.id}`}
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t(`dd.status_${p.status}`)}
            </span>
            {p.score_overall != null && (
              <ScoreBadge
                score={p.score_overall}
                confidence={p.score_confidence ?? 0}
              />
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold truncate">{p.name}</h3>
          {p.address_hint && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {p.address_hint}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

function ScoreBadge({
  score,
  confidence,
}: {
  score: number;
  confidence: number;
}) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : score >= 40
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${color}`}
      title={`Konfidenz ${Math.round(confidence * 100)} %`}
    >
      {score}/100
    </span>
  );
}
