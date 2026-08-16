/**
 * PDF-Text-Extraktion für DD-Dokumente.
 *
 * v1: nur echte Text-PDFs (die meisten Exposés und aktuellen WEG-Protokolle
 * sind so). Gescannte Alt-Protokolle (nur Bild) liefern leeren Text und
 * werden im DD-Flow als "OCR erforderlich" markiert — echte OCR
 * (tesseract / Cloud) folgt in einer späteren Iteration.
 *
 * Genutzt wird `unpdf` (leichtgewichtig, serverless-freundlich, kein
 * natives Modul, kein Canvas-Dependency).
 */

import { extractText, getDocumentProxy } from "unpdf";

export type PdfExtractionResult = {
  text: string;              // Ganzer Text, mit \n\n zwischen Seiten
  totalPages: number;
  textPages: number;         // Anzahl Seiten mit >20 Zeichen Text
  isProbablyScanned: boolean;
};

/**
 * Extrahiert Text aus einem PDF-Buffer. Wirft NICHT wenn ein PDF nur
 * Bilder enthält — liefert dann leeren Text und markiert
 * `isProbablyScanned: true`.
 */
export async function extractPdfText(
  buffer: ArrayBuffer | Uint8Array
): Promise<PdfExtractionResult> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(bytes);

  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  const textPages = pages.filter((p) => (p ?? "").trim().length > 20).length;
  const fullText = pages.map((p) => (p ?? "").trim()).join("\n\n");

  return {
    text: fullText,
    totalPages,
    textPages,
    // Faustregel: wenn > 80 % der Seiten fast leer sind, ist das PDF
    // wahrscheinlich gescannt und braucht OCR.
    isProbablyScanned: textPages < totalPages * 0.2,
  };
}

/**
 * Grobe Token-Schätzung für Cost-Anzeige — nicht als Basis für echte
 * Token-Abrechnung nutzen (dafür liefert Anthropic exakte Werte).
 * Faustregel für DE: ~4 Zeichen pro Token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
