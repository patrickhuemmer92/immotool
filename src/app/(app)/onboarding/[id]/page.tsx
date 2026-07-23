import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { requireUser } from "@/lib/auth";
import { isDdAdmin } from "@/lib/dd/admin";
import { getPremiumStatus } from "@/lib/billing/premium";
import { OnboardingUploader } from "./onboarding-uploader";
import { OnboardingConfirm } from "./confirm";
import { OnboardingPaywall } from "./paywall";

export default async function OnboardingProjectPage({
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
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select(
      "id, name, status, created_property_id, paid, premium_unlock, extracted_summary"
    )
    .eq("id", id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: docs } = await supabase
    .from("onboarding_documents")
    .select(
      "id, kind, filename, size_bytes, ocr_status, ocr_error, extracted_at, uploaded_at"
    )
    .eq("onboarding_project_id", id)
    .order("uploaded_at", { ascending: false });
  const documents = docs ?? [];

  const unlocked = project.paid || project.premium_unlock;

  // Wenn der Unlock via premium_unlock erfolgt und der Workspace KEIN
  // Paid-Abo hat, dann war es First-Object-Free. Das unterscheiden wir,
  // damit die UI den richtigen Vertrauens-Anker setzt („kostenlos für
  // dein erstes Objekt" vs. „in deinem Premium-Abo enthalten").
  const premium = await getPremiumStatus(active.id);
  const unlockedByFirstFree =
    project.premium_unlock && !project.paid && !premium.hasPaidSubscription;
  const unlockedByPremium = project.premium_unlock && premium.hasPaidSubscription;

  const summary = (project.extracted_summary ?? null) as
    | {
        kauf?: unknown;
        miete?: unknown[];
        darlehen?: unknown[];
      }
    | null;
  const hasExtractions =
    !!summary?.kauf ||
    (summary?.miete ?? []).length > 0 ||
    (summary?.darlehen ?? []).length > 0;

  return (
    <div>
      <Link
        href="/onboarding"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("onb.title")}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium">
          {t(`onb.status_${project.status}`)}
        </span>
      </div>

      {/* Unlock-Info: zeigt WARUM freigeschaltet (First-Free / Premium) */}
      {unlockedByFirstFree && (
        <section className="mt-6">
          <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
            <p className="text-sm font-medium text-green-900 dark:text-green-200">
              🎁 {t("onb.free_first_title")}
            </p>
            <p className="mt-1 text-xs text-green-800 dark:text-green-300">
              {t("onb.free_first_body")}
            </p>
          </div>
        </section>
      )}
      {unlockedByPremium && (
        <section className="mt-6">
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
            <p className="text-sm font-medium text-accent-foreground">
              ✓ {t("onb.premium_unlock_title")}
            </p>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {t("onb.premium_unlock_body")}
            </p>
          </div>
        </section>
      )}

      {/* Paywall (falls nicht bezahlt und kein Premium) — vor Upload */}
      {!unlocked && (
        <section className="mt-6">
          <OnboardingPaywall projectId={project.id} isAdmin={isAdmin} />
        </section>
      )}

      {/* Upload — nur wenn unlocked, sonst gemäß Paywall */}
      {unlocked && project.status !== "confirmed" && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("onb.upload_section")}
          </h2>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              {t("onb.upload_intro")}
            </p>
            <OnboardingUploader
              workspaceId={active.id}
              projectId={project.id}
              defaultKind="kaufvertrag"
            />
          </div>
        </section>
      )}

      {/* Doku-Liste */}
      {documents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("onb.documents_section")}
          </h2>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <ul>
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-3 p-3 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {t(`onb.kind_${d.kind}`)}{" "}
                      <span
                        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          d.ocr_status === "extracted"
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : d.ocr_status === "failed"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        }`}
                      >
                        {t(`onb.ocr_${d.ocr_status}`)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium truncate">
                      {d.filename}
                    </p>
                    {d.ocr_error && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {d.ocr_error}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Confirm-Editor mit den extrahierten Werten */}
      {unlocked && hasExtractions && project.status !== "confirmed" && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("onb.confirm_section")}
          </h2>
          <OnboardingConfirm
            projectId={project.id}
            initial={
              summary as {
                kauf?: Record<string, unknown>;
                miete?: Record<string, unknown>[];
                darlehen?: Record<string, unknown>[];
              }
            }
          />
        </section>
      )}

      {/* Nach Confirm: Link zum echten Objekt */}
      {project.status === "confirmed" && project.created_property_id && (
        <div className="mt-8 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-5">
          <p className="text-sm font-medium text-green-900 dark:text-green-200">
            ✓ {t("onb.confirmed_hint")}
          </p>
          <a
            href={`/objekte/${project.created_property_id}`}
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            → {t("onb.open_property")}
          </a>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
        <strong className="font-semibold">{t("onb.disclaimer_title")}:</strong>{" "}
        {t("onb.disclaimer_body")}
      </div>
    </div>
  );
}
