import { getTranslations } from "next-intl/server";

/**
 * Server-Component: generischer Placeholder-Content für die Findings-
 * Sektion, wenn der User noch NICHT bezahlt hat.
 *
 * Wichtig: hier landet KEINE echte Extraktion. Der User kann diese
 * Component per DevTools inspizieren — was er sieht ist bewusst generic,
 * so dass ein CSS-Trick zum Ausblenden des Paywall-Modals nichts an
 * echte Analyse-Daten heranführt.
 *
 * Der visuelle Hintergrund wird zusätzlich blurred, damit klar ist:
 * das ist der Bereich, der nach Freischaltung mit echten Inhalten
 * gefüllt wird.
 */
export async function AnalysisPreview() {
  const t = await getTranslations();
  return (
    <div className="space-y-6" aria-hidden="true">
      {/* Fake-Score */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Gesamt-Score
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-300 dark:text-neutral-700">
              — /100
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Konfidenz
            </p>
            <p className="text-2xl font-semibold tabular-nums text-neutral-300 dark:text-neutral-700">
              — %
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {["substanz", "finanz", "recht", "weg", "energie", "markt", "lage"].map(
            (c) => (
              <div
                key={c}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2 text-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
                  {c}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-300 dark:text-neutral-700">
                  —
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Skeleton-Findings — bewusst generic, kein echter Inhalt */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
        >
          <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-800 rounded mb-3" />
          <ul className="space-y-3">
            <li className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-3 w-24 bg-neutral-100 dark:bg-neutral-800 rounded" />
              </div>
              <div className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded mb-1" />
              <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-900 rounded mb-1" />
              <div className="h-3 w-5/6 bg-neutral-100 dark:bg-neutral-900 rounded" />
            </li>
            <li className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
              <div className="h-3 w-2/3 bg-neutral-200 dark:bg-neutral-800 rounded mb-1" />
              <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-900 rounded" />
            </li>
          </ul>
        </div>
      ))}

      {/* Screen-Reader-Text — falls jemand mit Screenreader unterwegs
          ist, soll klar sein was da steht. */}
      <p className="sr-only">{t("dd.preview_sr_note")}</p>
    </div>
  );
}
