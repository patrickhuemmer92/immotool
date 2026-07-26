"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteDdDocument } from "../document-actions";

type Doc = {
  id: string;
  kind: string;
  filename: string;
  size_bytes: number;
  ocr_status: string;
  ocr_error: string | null;
  extracted_at: string | null;
  uploaded_at: string;
};

/**
 * Übersichts-Liste aller hochgeladenen Dokumente eines DD-Projekts.
 * Zeigt Extraktions-Status inkl. Fehler und erlaubt Löschen.
 * Für v1 kein Trigger für Re-Extract — läuft automatisch beim Upload.
 */
export function DdDocumentList({
  projectId,
  docs,
}: {
  projectId: string;
  docs: Doc[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errorId, setErrorId] = useState<string | null>(null);

  function onDelete(docId: string) {
    if (!confirm(t("dd.confirm_delete_doc"))) return;
    setErrorId(null);
    start(async () => {
      try {
        await deleteDdDocument(docId, projectId);
        router.refresh();
      } catch (e) {
        setErrorId(docId + ":" + (e as Error).message);
      }
    });
  }

  /**
   * Manueller Re-Trigger für Extraktion. Nützlich wenn der ursprüngliche
   * fetch-Aufruf beim Upload abgebrochen wurde (Race gegen router.refresh)
   * oder das Doku auf 'failed' steht wegen Timeout — statt löschen+neu
   * hochladen einmal draufklicken.
   */
  function onRetry(docId: string) {
    setErrorId(null);
    start(async () => {
      const res = await fetch("/api/dd/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dd_project_id: projectId,
          document_id: docId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setErrorId(docId + ":" + (j?.error ?? res.statusText));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <ul>
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 p-4 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t(`dd.doc_kind_${d.kind}`)}
                </span>
                <StatusChip status={d.ocr_status} t={t} />
              </div>
              <div className="mt-1 text-sm font-medium truncate">
                {d.filename}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                {fmtBytes(d.size_bytes)} · {new Date(d.uploaded_at).toLocaleDateString("de-DE")}
              </div>
              {/* Fehler nur zeigen wenn Status wirklich failed —
                  sonst würde bei erfolgreichem Retry der alte Fehler
                  stehen bleiben. */}
              {d.ocr_error && d.ocr_status === "failed" && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {d.ocr_error}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {(d.ocr_status === "pending" || d.ocr_status === "failed") && (
                <button
                  type="button"
                  onClick={() => onRetry(d.id)}
                  disabled={pending}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  {t("dd.retry_extract")}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(d.id)}
                disabled={pending}
                className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                {t("common.delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {errorId && (
        <p className="p-3 text-xs text-red-600 dark:text-red-400">{errorId}</p>
      )}
    </div>
  );
}

function StatusChip({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const cls = {
    pending: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    extracted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    not_needed:
      "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400",
  }[status] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {t(`dd.ocr_${status}`)}
    </span>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
