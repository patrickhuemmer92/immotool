import { describe, expect, it } from "vitest";
import {
  formatNotesForPrompt,
  isNoteSource,
  type DdProjectNote,
} from "@/lib/dd/notes";

function note(p: Partial<DdProjectNote> & { note: string }): DdProjectNote {
  return {
    id: p.id ?? crypto.randomUUID(),
    occurred_on: p.occurred_on ?? "2026-01-01",
    source: p.source ?? "sonstiges",
    created_at: p.created_at ?? "2026-01-01T00:00:00.000Z",
    note: p.note,
  };
}

describe("formatNotesForPrompt", () => {
  it("gibt null zurueck, wenn es nichts zu sagen gibt", () => {
    expect(formatNotesForPrompt([])).toBeNull();
  });

  it("sortiert aelteste zuerst — das Modell soll die Entwicklung von vorne lesen", () => {
    const out = formatNotesForPrompt([
      note({ occurred_on: "2026-03-10", note: "Spaeter" }),
      note({ occurred_on: "2026-01-05", note: "Frueher" }),
    ]);
    expect(out).not.toBeNull();
    const lines = out!.split("\n");
    expect(lines[0]).toContain("Frueher");
    expect(lines[1]).toContain("Spaeter");
  });

  it("entscheidet bei gleichem Datum nach Eingabezeitpunkt", () => {
    const out = formatNotesForPrompt([
      note({
        occurred_on: "2026-02-01",
        created_at: "2026-02-01T12:00:00.000Z",
        note: "Zweite",
      }),
      note({
        occurred_on: "2026-02-01",
        created_at: "2026-02-01T09:00:00.000Z",
        note: "Erste",
      }),
    ]);
    const lines = out!.split("\n");
    expect(lines[0]).toContain("Erste");
    expect(lines[1]).toContain("Zweite");
  });

  it("nennt Datum und Quelle in Klartext", () => {
    const out = formatNotesForPrompt([
      note({
        occurred_on: "2026-04-17",
        source: "verwalter",
        note: "Dachsanierung 2027 beschlossen.",
      }),
    ]);
    expect(out).toBe("- 17.04.2026 (Hausverwaltung): Dachsanierung 2027 beschlossen.");
  });

  it("laesst die Eingabeliste unangetastet", () => {
    const input = [
      note({ occurred_on: "2026-03-10", note: "B" }),
      note({ occurred_on: "2026-01-05", note: "A" }),
    ];
    formatNotesForPrompt(input);
    expect(input[0].note).toBe("B");
  });
});

describe("isNoteSource", () => {
  it("akzeptiert bekannte Quellen", () => {
    expect(isNoteSource("makler")).toBe(true);
    expect(isNoteSource("eigene_beobachtung")).toBe(true);
  });

  it("weist Unbekanntes ab — die DB hat denselben Check", () => {
    expect(isNoteSource("nachbar")).toBe(false);
    expect(isNoteSource(null)).toBe(false);
    expect(isNoteSource(42)).toBe(false);
  });
});
