"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "estateably-onboarding-dismissed";

export type StepState = "done" | "active" | "pending";

export type OnboardingStep = {
  /** Stable id for keys. */
  id: "property" | "loan" | "tenant_or_cashflow" | "factbook";
  label: string;
  state: StepState;
  /** Optional CTA — only the first non-done step gets a link, others stay
   *  visual-only. */
  href?: string;
};

/**
 * Onboarding-Stepper (Spec Task 2). Horizontal, nummerierte Kreise mit
 * Verbindungslinien. Türkis = aktiv (=erster pending), Häkchen = erledigt.
 * Wenn alle erledigt sind oder der User dismissed hat → null.
 */
export function OnboardingStepper({
  steps,
  dismissLabel,
  allDoneLabel,
}: {
  steps: OnboardingStep[];
  dismissLabel: string;
  allDoneLabel: string;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const allDone = steps.every((s) => s.state === "done");

  // Wenn alles erledigt UND nicht dismissed → kurz "fertig" anzeigen,
  // sonst nichts. Wenn dismissed → nie.
  if (dismissed) return null;
  if (allDone) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-2.5 flex items-center gap-3">
        <CheckCircle />
        <span className="text-sm font-medium">{allDoneLabel}</span>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="ml-auto text-xs text-neutral-700 dark:text-neutral-300 hover:underline"
        >
          {dismissLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
      <ol className="flex items-center gap-0 overflow-x-auto">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`flex items-center gap-3 min-w-0 ${
              i < steps.length - 1 ? "flex-1" : ""
            }`}
          >
            <StepBubble index={i + 1} state={s.state} />
            <div className="flex flex-col min-w-0">
              <span
                className={`text-xs font-medium truncate ${
                  s.state === "active"
                    ? "text-accent-foreground"
                    : s.state === "done"
                      ? "text-neutral-700 dark:text-neutral-300"
                      : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {s.label}
              </span>
              {s.href && s.state === "active" && (
                <Link
                  href={s.href}
                  className="text-[11px] text-accent hover:underline mt-0.5"
                >
                  →
                </Link>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 ${
                  s.state === "done"
                    ? "bg-accent"
                    : "bg-neutral-200 dark:bg-neutral-800"
                }`}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepBubble({
  index,
  state,
}: {
  index: number;
  state: StepState;
}) {
  if (state === "done") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground shrink-0">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12l5 5 9-11" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold shrink-0 ring-4 ring-accent/20">
        {index}
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
      {index}
    </span>
  );
}

function CheckCircle() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground shrink-0"
      aria-hidden
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l5 5 9-11" />
      </svg>
    </span>
  );
}
