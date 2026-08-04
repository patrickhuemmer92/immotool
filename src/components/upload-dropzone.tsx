"use client";

/**
 * Datei-Ablagefläche der Uploader (KI-Onboarding und Objekt-Analyse).
 *
 * Der laufende Upload braucht ein sichtbares Signal: die Extraktion
 * dauert 30–90 Sekunden, und ohne Rückmeldung klicken Leute ein zweites
 * Mal oder navigieren weg. Im Onboarding gab es dafür bereits einen
 * Spinner samt blau eingefärbter Fläche — in der Analyse wurde nur der
 * Hinweistext ausgetauscht, was im Betrieb kaum auffällt.
 *
 * Der Zustand liegt jetzt einmal hier, damit beide Flows nicht wieder
 * auseinanderlaufen. Die Upload-Logik bleibt bewusst in den jeweiligen
 * Uploadern — die unterscheidet sich (Storage-Pfad, Registrierung,
 * Extract-Endpoint) und gehört nicht in eine Darstellungs-Komponente.
 */
export function UploadDropzone({
  inputId,
  uploading,
  progressText,
  hint,
  sizeHint,
}: {
  /** id des zugehörigen <input type="file">. */
  inputId: string;
  uploading: boolean;
  /** Text während des Uploads (z. B. „Datei wird hochgeladen…"). */
  progressText: string;
  /** Aufforderung im Ruhezustand. */
  hint: string;
  /** Zweite Zeile im Ruhezustand (Größen-/Formathinweis). */
  sizeHint: string;
}) {
  return (
    <label
      htmlFor={inputId}
      aria-busy={uploading}
      className={`block cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        uploading
          ? "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30"
          : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
      }`}
    >
      {uploading ? (
        <div className="flex items-center justify-center gap-3">
          <svg
            className="h-5 w-5 shrink-0 animate-spin text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
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
          <p
            aria-live="polite"
            className="text-sm font-medium text-blue-900 dark:text-blue-200"
          >
            {progressText}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {hint}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {sizeHint}
          </p>
        </>
      )}
    </label>
  );
}
