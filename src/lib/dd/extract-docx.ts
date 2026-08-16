/**
 * DOCX-Text-Extraktion für DD- und Onboarding-Dokumente.
 *
 * Anthropic akzeptiert nur PDF als document-Content-Block. DOCX kann
 * nicht direkt an das LLM übergeben werden. ABER: DOCX ist von Natur
 * aus Text-basiert (XML-Container), also können wir den Text
 * verlustfrei extrahieren und im Text-Modus an das LLM schicken.
 *
 * `mammoth` ist die Standard-Bibliothek dafür — extrahiert reinen
 * Text (ohne Layout, aber mit Absätzen), keine Bilder.
 */

import mammoth from "mammoth";

export type DocxExtractionResult = {
  text: string;
};

export async function extractDocxText(
  buffer: ArrayBuffer | Uint8Array
): Promise<DocxExtractionResult> {
  // mammoth erwartet einen Node Buffer.
  const nodeBuf =
    buffer instanceof Uint8Array
      ? Buffer.from(buffer)
      : Buffer.from(new Uint8Array(buffer));

  const result = await mammoth.extractRawText({ buffer: nodeBuf });
  return { text: (result.value ?? "").trim() };
}
