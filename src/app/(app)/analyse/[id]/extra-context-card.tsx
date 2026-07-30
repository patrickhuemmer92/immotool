"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveExtraUserContext } from "../actions";

/**
 * Freifeld: Zusätzliche Käufer-Info die in den nächsten Analyze-Call
 * einfließt. Typisch: „Verkäufer erwähnte Dachschaden 2024",
 * „Bin Familienmensch, will einziehen — kein Ren-di-tenobjekt".
 *
 * Klein-und-collapsable — soll nicht dominieren, aber sichtbar sein.
 */
export function ExtraContextCard({
  projectId,
  initial,
}: {
  projectId: string;
  initial: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [expanded, setExpanded] = useState(initial.trim().length > 0);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSave() {
    start(async () => {
      const res = await saveExtraUserContext(projectId, text);
      if (!res.error) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline underline-offset-2 decoration-dotted"
      >
        + {t("dd.extra_context_add")}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">
            {t("dd.extra_context_title")}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t("dd.extra_context_hint")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (text.trim().length === 0) setExpanded(false);
          }}
          className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          {text.trim().length === 0 ? t("common.close") : ""}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={t("dd.extra_context_placeholder")}
        className="mt-3 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-neutral-500 dark:text-neutral-400">
          {text.length} / 2000
        </span>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-green-600 dark:text-green-400">
              ✓ {t("common.saved")}
            </span>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
