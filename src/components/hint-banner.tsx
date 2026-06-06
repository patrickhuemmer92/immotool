"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_PREFIX = "estateably-hint:";

export type HintTone = "info" | "warning";

/**
 * Hinweis-Banner für fehlende Daten (Spec Task 5). Dismiss persistiert per
 * Banner-ID in localStorage; Server entscheidet anhand der Daten, ob
 * der Banner überhaupt gerendert wird.
 */
export function HintBanner({
  id,
  tone = "info",
  title,
  body,
  cta,
  ctaHref,
  dismissLabel,
}: {
  id: string;
  tone?: HintTone;
  title: string;
  body: string;
  cta: string;
  ctaHref: string;
  dismissLabel: string;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_PREFIX + id);
      setDismissed(v === "1");
    } catch {
      setDismissed(false);
    }
  }, [id]);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + id, "1");
    } catch {
      /* ignore */
    }
  }

  if (dismissed) return null;

  const colors =
    tone === "warning"
      ? {
          panel:
            "border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40",
          iconWrap:
            "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-900",
          title: "text-amber-900 dark:text-amber-100",
        }
      : {
          panel:
            "border-accent/30 bg-accent-soft",
          iconWrap:
            "bg-accent/15 text-accent-foreground border-accent/30",
          title: "text-accent-foreground",
        };

  return (
    <div
      className={`rounded-2xl border ${colors.panel} px-4 py-3 flex items-start gap-3`}
      role="status"
    >
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${colors.iconWrap} shrink-0`}
        aria-hidden
      >
        {tone === "warning" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01" />
            <path d="M11 12h1v4h1" />
          </svg>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.title}`}>{title}</div>
        <p className="mt-0.5 text-xs text-neutral-700 dark:text-neutral-300 leading-snug">
          {body}
        </p>
        <Link
          href={ctaHref}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-foreground hover:underline"
        >
          {cta}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" /><path d="M13 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
        className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 p-1 -m-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
