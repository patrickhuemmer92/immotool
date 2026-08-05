"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { dateDe } from "@/lib/format";
import { FormError } from "@/components/form-error";
import { NOTE_SOURCES, type DdProjectNote } from "@/lib/dd/notes";
import { addProjectNote, deleteProjectNote } from "../actions";

/**
 * Gesprächsnotizen zum Projekt — was nach Besichtigung, Rückruf oder
 * Termin dazukommt und in keinem Dokument steht.
 *
 * Bewusst eine Liste statt eines Freitextfelds: mit Datum und Quelle
 * kann die Analyse erkennen, dass eine spätere Aussage eine frühere
 * korrigiert. Neueste Notiz oben — im Prompt läuft die Liste umgekehrt,
 * damit das Modell die Entwicklung von vorne liest.
 */
export function NotesLog({
  projectId,
  notes,
  readOnly = false,
}: {
  projectId: string;
  notes: DdProjectNote[];
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(notes.length > 0);
  const [text, setText] = useState("");
  const [source, setSource] = useState<string>("makler");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAdd() {
    setError(null);
    start(async () => {
      const res = await addProjectNote(projectId, {
        note: text,
        source,
        occurred_on: occurredOn,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setText("");
      setOccurredOn(todayIso());
      router.refresh();
    });
  }

  function onDelete(noteId: string) {
    start(async () => {
      const res = await deleteProjectNote(projectId, noteId);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (!open && notes.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline underline-offset-2 decoration-dotted"
      >
        + {t("dd.notes_add_first")}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div>
        <h3 className="text-sm font-medium">{t("dd.notes_title")}</h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.notes_hint")}
        </p>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {dateDe(n.occurred_on)} ·{" "}
                    <span className="font-medium">
                      {t(`dd.note_source_${n.source}`)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                    {n.note}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    disabled={pending}
                    aria-label={t("common.delete")}
                    className="shrink-0 text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="mt-3 border-t border-neutral-200 dark:border-neutral-800 pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("dd.notes_placeholder")}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label={t("dd.notes_source_label")}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs"
            >
              {NOTE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`dd.note_source_${s}`)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={occurredOn}
              max={todayIso()}
              onChange={(e) => setOccurredOn(e.target.value)}
              aria-label={t("dd.notes_date_label")}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs"
            />
            <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
              {text.length} / 2000
            </span>
            <button
              type="button"
              onClick={onAdd}
              disabled={pending || text.trim().length === 0}
              className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.loading") : t("dd.notes_save")}
            </button>
          </div>
          <FormError raw={error ?? undefined} />
          {notes.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {t("dd.notes_rerun_hint")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
