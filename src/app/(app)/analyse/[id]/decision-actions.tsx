"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  moveToWatchlist,
  moveOutOfWatchlist,
  archiveDdProject,
  promoteToProperty,
} from "../actions";

/**
 * Statuswechsel-Buttons — Watchlist / Archiv / Kauf.
 * Wird nur angezeigt, wenn eine Analyse gelaufen ist (score_overall != null).
 */
export function DecisionActions({
  projectId,
  status,
  promotedPropertyId,
}: {
  projectId: string;
  status: string;
  promotedPropertyId: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onWatchlist() {
    start(async () => {
      await moveToWatchlist(projectId);
      router.refresh();
    });
  }
  function onUnwatch() {
    start(async () => {
      await moveOutOfWatchlist(projectId);
      router.refresh();
    });
  }
  function onArchive() {
    if (!confirm(t("dd.confirm_archive"))) return;
    start(async () => {
      await archiveDdProject(projectId);
    });
  }
  function onPromote() {
    if (!confirm(t("dd.confirm_promote"))) return;
    setError(null);
    start(async () => {
      const result = await promoteToProperty(projectId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/objekte/${result.propertyId}`);
    });
  }

  if (status === "promoted" && promotedPropertyId) {
    return (
      <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
        <p className="text-sm font-medium text-green-900 dark:text-green-200">
          {t("dd.promoted_hint")}
        </p>
        <a
          href={`/objekte/${promotedPropertyId}`}
          className="mt-2 inline-block text-sm text-accent hover:underline"
        >
          → {t("dd.open_property")}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold mb-3">
        {t("dd.decision_title")}
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
        {t("dd.decision_help")}
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "watchlist" ? (
          <button
            type="button"
            onClick={onUnwatch}
            disabled={pending}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {t("dd.unwatch")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onWatchlist}
            disabled={pending}
            className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 px-3 py-2 text-sm hover:bg-blue-100 dark:hover:bg-blue-950 disabled:opacity-50"
          >
            ★ {t("dd.watch")}
          </button>
        )}
        <button
          type="button"
          onClick={onPromote}
          disabled={pending}
          className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {t("dd.promote_to_property")}
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {t("dd.archive")}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error === "address_missing"
            ? t("dd.promote_error_address")
            : error}
        </p>
      )}
    </div>
  );
}
