/**
 * Gesprächsnotizen eines DD-Projekts (Migration 0032).
 *
 * Der Typ und die Prompt-Formatierung liegen hier zusammen, weil beide
 * Prompt-Bauer (Konsolidierung und externes Dossier) dieselbe Darstellung
 * brauchen — und weil genau diese Darstellung der Punkt der Übung ist:
 * als datierte Liste kann das Modell erkennen, dass eine spätere Aussage
 * eine frühere korrigiert. Im alten Freitextfeld stand beides
 * gleichwertig nebeneinander.
 */

export const NOTE_SOURCES = [
  "makler",
  "verwalter",
  "verkaeufer",
  "eigene_beobachtung",
  "handwerker",
  "bank",
  "sonstiges",
] as const;

export type NoteSource = (typeof NOTE_SOURCES)[number];

export function isNoteSource(v: unknown): v is NoteSource {
  return typeof v === "string" && (NOTE_SOURCES as readonly string[]).includes(v);
}

export type DdProjectNote = {
  id: string;
  /** ISO-Datum (YYYY-MM-DD) des Gesprächs — nicht des Eintippens. */
  occurred_on: string;
  source: NoteSource;
  note: string;
  created_at: string;
};

/** Klartext-Bezeichnung der Quelle für den Prompt (nicht für die UI —
 *  die übersetzt über next-intl). */
const SOURCE_LABEL: Record<NoteSource, string> = {
  makler: "Makler",
  verwalter: "Hausverwaltung",
  verkaeufer: "Verkäufer",
  eigene_beobachtung: "eigene Beobachtung",
  handwerker: "Handwerker/Gutachter",
  bank: "Bank",
  sonstiges: "sonstige Quelle",
};

/**
 * Notizen als chronologische Liste für den Prompt — ÄLTESTE ZUERST.
 *
 * Die Reihenfolge ist bewusst umgekehrt zur UI (dort steht das Neueste
 * oben). Ein Modell liest die Liste von oben nach unten und soll dabei
 * dieselbe Entwicklung nachvollziehen wie jemand, der die Gespräche
 * der Reihe nach geführt hat.
 *
 * Gibt `null` zurück, wenn es nichts zu sagen gibt — die Aufrufer
 * hängen den Block dann gar nicht erst an.
 */
export function formatNotesForPrompt(
  notes: readonly DdProjectNote[]
): string | null {
  if (notes.length === 0) return null;

  const sorted = [...notes].sort((a, b) => {
    const byDate = a.occurred_on.localeCompare(b.occurred_on);
    if (byDate !== 0) return byDate;
    return a.created_at.localeCompare(b.created_at);
  });

  return sorted
    .map((n) => {
      const label = SOURCE_LABEL[n.source] ?? SOURCE_LABEL.sonstiges;
      return `- ${formatDate(n.occurred_on)} (${label}): ${n.note.trim()}`;
    })
    .join("\n");
}

/** YYYY-MM-DD → TT.MM.JJJJ. Unbekanntes Format bleibt unverändert. */
function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
