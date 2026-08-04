import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UploadDropzone } from "@/components/upload-dropzone";

/**
 * Der Uploader der Objekt-Analyse hatte während des Uploads nur einen
 * ausgetauschten Hinweistext — kein sichtbares Signal, dass etwas läuft.
 * Diese Tests halten den animierten Zustand fest, den beide Flows nutzen.
 */
const props = {
  inputId: "test-file",
  progressText: "Datei wird hochgeladen…",
  hint: "Datei hierher ziehen",
  sizeHint: "max. 20 MB",
};

describe("UploadDropzone", () => {
  it("zeigt beim Upload Spinner und Fortschrittstext", () => {
    const html = renderToStaticMarkup(
      createElement(UploadDropzone, { ...props, uploading: true })
    );
    expect(html).toContain("animate-spin");
    expect(html).toContain("Datei wird hochgeladen");
    // Ruhezustand-Texte sind währenddessen weg.
    expect(html).not.toContain("Datei hierher ziehen");
    // Screenreader bekommen den Zustand ebenfalls mit.
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
  });

  it("zeigt im Ruhezustand die Hinweise und keine Animation", () => {
    const html = renderToStaticMarkup(
      createElement(UploadDropzone, { ...props, uploading: false })
    );
    expect(html).toContain("Datei hierher ziehen");
    expect(html).toContain("max. 20 MB");
    expect(html).not.toContain("animate-spin");
  });

  it("verweist auf das zugehörige File-Input", () => {
    const html = renderToStaticMarkup(
      createElement(UploadDropzone, { ...props, uploading: false })
    );
    expect(html).toContain('for="test-file"');
  });
});
