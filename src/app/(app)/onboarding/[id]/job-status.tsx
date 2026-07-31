"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type StatusResponse = {
  project: {
    status: string;
    created_property_id: string | null;
  };
  documents: Array<{
    id: string;
    kind: string;
    filename: string;
    ocr_status: string;
    ocr_error: string | null;
    extracted_at: string | null;
  }>;
};

/**
 * Sticky-Status-Widget für die Onboarding-Detail-Seite. Zeigt für
 * jedes gerade laufende Extract-Job eine animierte Zeile. Pollt alle
 * 2s solange pending-Docs existieren; ruft router.refresh() sobald
 * ein Doku fertig wird (via Timestamp-Fingerprint gegen Doppel-Refresh).
 * Analog zu dd-job-status.
 */
export function OnbJobStatusWidget({
  projectId,
  initialDocs,
}: {
  projectId: string;
  initialDocs: Array<{ id: string; ocr_status: string }>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const lastRefreshRef = useRef<string>("");

  const initialPending = initialDocs.some((d) => d.ocr_status === "pending");
  const [visible, setVisible] = useState(initialPending);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/onboarding/status?onboarding_project_id=${encodeURIComponent(projectId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        setStatus(data);

        const stillPending = data.documents.some(
          (d) => d.ocr_status === "pending"
        );
        const fingerprint = data.documents
          .filter((d) => d.ocr_status === "extracted" && d.extracted_at)
          .map((d) => `${d.id}:${d.extracted_at}`)
          .join(",");
        if (fingerprint && fingerprint !== lastRefreshRef.current) {
          lastRefreshRef.current = fingerprint;
          router.refresh();
        }

        if (!stillPending) {
          setVisible(false);
          return;
        }
        timer = setTimeout(tick, 2000);
      } catch {
        timer = setTimeout(tick, 5000);
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, router, visible]);

  if (!visible) return null;

  const pending = (status?.documents ?? []).filter(
    (d) => d.ocr_status === "pending"
  );
  const failed = (status?.documents ?? []).filter(
    (d) => d.ocr_status === "failed"
  );

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
      <div className="flex items-start gap-3">
        <Spinner />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            {t("dd.job_running_title")}
          </h3>
          <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
            {t("dd.job_running_body", { count: pending.length })}
          </p>
          {pending.length > 0 && (
            <ul className="mt-2 space-y-1">
              {pending.map((d) => (
                <li
                  key={d.id}
                  className="text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="truncate">{d.filename}</span>
                  <span className="text-blue-500 dark:text-blue-400 shrink-0">
                    · {t(`onb.kind_${d.kind}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {failed.length > 0 && (
            <div className="mt-2 text-xs text-red-700 dark:text-red-300">
              {failed.map((d) => (
                <div key={d.id}>
                  {d.filename}: {d.ocr_error}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 shrink-0 animate-spin text-blue-500"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
