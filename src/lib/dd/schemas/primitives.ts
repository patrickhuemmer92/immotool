/**
 * Gemeinsame Schema-Bausteine für die DD-Extraktion.
 *
 * Hintergrund: Die Extraktions-Schemas beschreiben, was wir vom LLM
 * ERWARTEN. Wo ein Feld freien Text enthält, weicht das Modell aber
 * regelmäßig auf einen Skalar aus, wenn der Hinweis im Dokument selbst
 * nur eine Zahl ist — z. B. `"geg_hinweise": ["Heizung Baujahr", 1998]`
 * oder `["Austauschpflicht ab", 2045]`. Das ist inhaltlich brauchbar,
 * verletzt aber `z.array(z.string())` und kippt die ganze Extraktion.
 *
 * Statt das Modell dafür in einen (teuren, unzuverlässigen) Retry zu
 * schicken, nehmen wir solche Ausrutscher hier an und normalisieren sie.
 * Ein Wert, den wir verlustfrei zu Text machen können, ist kein Grund,
 * ein 40-seitiges Dokument neu analysieren zu lassen.
 */

import { z } from "zod";

/** Skalare, die sich verlustfrei als Text darstellen lassen. */
const scalarAsString = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((v) => (typeof v === "string" ? v : String(v)));

/**
 * Freitext-Liste, tolerant gegenüber LLM-typischer Shape-Drift:
 *
 *   - Zahlen/Booleans in der Liste werden zu Text (`1998` → `"1998"`).
 *   - `null`/`undefined`-Einträge fliegen raus (das Modell füllt Lücken
 *     gerne mit `null` statt den Eintrag wegzulassen).
 *   - Ein einzelner Skalar statt einer Liste wird zur Ein-Element-Liste
 *     (`"Keine Hinweise"` → `["Keine Hinweise"]`).
 *
 * Objekte werden bewusst NICHT akzeptiert — daraus einen String zu
 * machen ergäbe `"[object Object]"`, und ein Objekt an dieser Stelle
 * heißt, dass das Modell die Struktur missverstanden hat. Dann ist ein
 * Retry richtig.
 */
export function looseStringArray() {
  return z.preprocess((v) => {
    if (v === null || v === undefined) return [];
    const list = Array.isArray(v) ? v : [v];
    return list.filter((e) => e !== null && e !== undefined);
  }, z.array(scalarAsString));
}
