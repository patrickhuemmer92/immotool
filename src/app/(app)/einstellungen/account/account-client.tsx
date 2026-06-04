"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Account-Settings (DSGVO):
 *   - Daten-Export: einfacher GET-Aufruf an /api/account/data-export
 *     → Browser bekommt JSON-Datei als Download.
 *   - Account-Löschung: Confirm-Modal mit Email-Bestätigung →
 *     POST /api/account/delete → bei Success Logout-Redirect.
 */
export function AccountClient({
  userEmail,
  userId,
  createdAt,
}: {
  userEmail: string;
  userId: string;
  createdAt: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();

  // -- Delete-Flow ------------------------------------------------------
  const [showDelete, setShowDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pendingDelete, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: confirmEmail }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setDeleteError(json.error ?? "unknown");
        return;
      }
      // Account ist weg → Login-Seite. Server-side ist Session schon
      // signed-out, hier sicherheitshalber redirect.
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* User-Übersicht */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold">{t("settings.account_section")}</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-3">
            <dt className="w-32 text-neutral-500 dark:text-neutral-400">
              {t("auth.email")}
            </dt>
            <dd className="font-mono">{userEmail}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 text-neutral-500 dark:text-neutral-400">
              {t("settings.account_user_id")}
            </dt>
            <dd className="font-mono text-xs">{userId}</dd>
          </div>
          {createdAt && (
            <div className="flex gap-3">
              <dt className="w-32 text-neutral-500 dark:text-neutral-400">
                {t("settings.account_created_at")}
              </dt>
              <dd>
                {new Date(createdAt).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Daten-Export */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold">
          {t("settings.account_export_title")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
          {t("settings.account_export_help")}
        </p>
        <a
          href="/api/account/data-export"
          download
          className="mt-4 inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          {t("settings.account_export_action")}
        </a>
      </section>

      {/* Account löschen */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 p-5">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
          {t("settings.account_delete_title")}
        </h2>
        <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80 max-w-xl">
          {t("settings.account_delete_help")}
        </p>
        <button
          type="button"
          onClick={() => {
            setShowDelete(true);
            setConfirmEmail("");
            setDeleteError(null);
          }}
          className="mt-4 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950"
        >
          {t("settings.account_delete_action")}
        </button>
      </section>

      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pendingDelete && setShowDelete(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 max-w-md w-full shadow-xl"
          >
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
              {t("settings.account_delete_confirm_title")}
            </h3>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              {t("settings.account_delete_confirm_intro")}
            </p>
            <ul className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 list-disc pl-5 space-y-0.5">
              <li>{t("settings.account_delete_bullet_workspaces")}</li>
              <li>{t("settings.account_delete_bullet_subscriptions")}</li>
              <li>{t("settings.account_delete_bullet_payments")}</li>
            </ul>
            <p className="mt-3 text-xs text-red-700 dark:text-red-300">
              {t("settings.account_delete_irreversible")}
            </p>

            <label className="mt-4 block text-sm font-medium">
              {t("settings.account_delete_confirm_label", {
                email: userEmail,
              })}
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={userEmail}
              className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />

            {deleteError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {t("common.error")}: {deleteError}
              </p>
            )}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                disabled={pendingDelete}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={
                  pendingDelete ||
                  confirmEmail.trim().toLowerCase() !==
                    userEmail.trim().toLowerCase()
                }
                className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingDelete
                  ? t("common.loading")
                  : t("settings.account_delete_confirm_action")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
