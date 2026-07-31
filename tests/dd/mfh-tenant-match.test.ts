import { describe, it, expect } from "vitest";

/**
 * Testet die interne Matching-Logik aus confirmOnboarding
 * (parseUnitFromRef + Fallback-Kette). Die Funktionen sind aktuell
 * inline in der Server-Action — hier bilden wir sie zu Test-Zwecken ab.
 * Wenn die Server-Action sich ändert, sollten diese Tests mit-ziehen.
 */

function parseUnitFromRef(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(/\b(\d{1,3})\b/);
  return m ? m[1] : null;
}

type SubUnit = { id: string; unit_number: string };

function pickTargetSub(
  subs: SubUnit[],
  taken: Set<string>,
  ref: string | null
): SubUnit | null {
  const wanted = parseUnitFromRef(ref);
  const byNumber = wanted
    ? subs.find((s) => s.unit_number === wanted && !taken.has(s.id))
    : undefined;
  if (byNumber) return byNumber;
  const firstFree = subs.find((s) => !taken.has(s.id));
  return firstFree ?? null;
}

describe("parseUnitFromRef", () => {
  it("extrahiert Zahl aus verschiedenen Formaten", () => {
    expect(parseUnitFromRef("Wohnung Nr. 3")).toBe("3");
    expect(parseUnitFromRef("Whg. 12")).toBe("12");
    expect(parseUnitFromRef("Einheit 04")).toBe("04");
    expect(parseUnitFromRef("2. OG links")).toBe("2");
  });

  it("liefert null bei fehlender Zahl oder null-Eingabe", () => {
    expect(parseUnitFromRef(null)).toBe(null);
    expect(parseUnitFromRef("")).toBe(null);
    expect(parseUnitFromRef("EG links")).toBe(null);
  });

  it("nimmt erste Zahl, wenn mehrere im Text sind", () => {
    expect(parseUnitFromRef("Wohnung 3 in Haus 2")).toBe("3");
  });
});

describe("pickTargetSub — MFH-Zuordnungs-Regel", () => {
  const subs: SubUnit[] = [
    { id: "sub1", unit_number: "1" },
    { id: "sub2", unit_number: "2" },
    { id: "sub3", unit_number: "3" },
  ];

  it("matcht Sub via unit_reference-Zahl", () => {
    const r = pickTargetSub(subs, new Set(), "Wohnung Nr. 2");
    expect(r?.id).toBe("sub2");
  });

  it("überspringt bereits belegte Sub → Fallback: erste freie", () => {
    // Sub2 ist schon belegt, ref sagt "Nr. 2" — Fallback greift.
    const r = pickTargetSub(subs, new Set(["sub2"]), "Wohnung Nr. 2");
    expect(r?.id).toBe("sub1"); // erste freie ist sub1
  });

  it("ohne Referenz: erste freie Sub", () => {
    const r = pickTargetSub(subs, new Set(["sub1"]), null);
    expect(r?.id).toBe("sub2");
  });

  it("wenn alle belegt: null (Caller fällt auf Haupt-Property zurück)", () => {
    const r = pickTargetSub(
      subs,
      new Set(["sub1", "sub2", "sub3"]),
      "Nr. 4"
    );
    expect(r).toBe(null);
  });

  it("Zahl außerhalb der Sub-Range → Fallback: erste freie", () => {
    // Nur 3 Wohnungen vorhanden, Referenz sagt "Nr. 4" → Fallback
    const r = pickTargetSub(subs, new Set(), "Wohnung Nr. 4");
    expect(r?.id).toBe("sub1");
  });
});
