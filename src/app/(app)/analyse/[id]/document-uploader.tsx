"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerDdDocument } from "../document-actions";

const ALL_KINDS = [
  "expose",
  "weg_minutes",
  "wirtschaftsplan",
  "teilungserklaerung",
  "energieausweis",
  "grundriss",
  "grundbuchauszug",
  "mieterliste",
  "other",
] as const;

const KIND_LABEL: Record<(typeof ALL_KINDS)[number], string> = {
  expose: "dd.doc_kind_expose",
  weg_minutes: "dd.doc_kind_weg",
  wirtschaftsplan: "dd.doc_kind_budget",
  teilungserklaerung: "dd.doc_kind_teilung",
  energieausweis: "dd.doc_kind_energie",
  grundriss: "dd.doc_kind_grundriss",
  grundbuchauszug: "dd.doc_kind_grundbuch",
  mieterliste: "dd.doc_kind_mieterliste",
  other: "dd.doc_kind_other",
};

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc (Legacy)
  "image/jpeg",
  "image/png",
  "image/webp",
];

type Kind =
  | "expose"
  | "weg_minutes"
  | "wirtschaftsplan"
  | "teilungserklaerung"
  | "energieausweis"
  | "grundriss"
  | "grundbuchauszug"
  | "mieterliste"
  | "other";

export function DocumentUploader({
  workspaceId,
  projectId,
  defaultKind = "expose",
  autoExtract = true,
  allowedKinds,
}: {
  workspaceId: string;
  projectId: string;
  defaultKind?: Kind;
  /** Nach Upload sofort Extraktion starten. */
  autoExtract?: boolean;
  /** Wenn gesetzt: nur diese Doku-Typen im Dropdown anzeigen. */
  allowedKinds?: readonly Kind[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [uploading, startUpload] = useTransition();
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setProgressMsg(null);

    if (file.size > MAX_BYTES) {
      setError(t("dd.upload_error_too_large"));
      return;
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      setError(t("dd.upload_error_bad_type"));
      return;
    }

    startUpload(async () => {
      try {
        setProgressMsg(t("dd.uploading"));

        // Client-Direct-Upload nach dem Storage-Bucket. Pfad-Pattern
        // muss zu den RLS-Policies passen (<workspace_id>/…).
        const ext = fileExt(file.name, file.type);
        const path = `${workspaceId}/${projectId}/${crypto.randomUUID()}.${ext}`;

        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("dd-documents")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (upErr) {
          setError(t("dd.upload_error_generic") + ": " + upErr.message);
          setProgressMsg(null);
          return;
        }

        // Doku-Row anlegen
        const reg = await registerDdDocument({
          dd_project_id: projectId,
          kind,
          filename: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (reg?.error || !reg?.documentId) {
          setError(t("dd.upload_error_register") + ": " + reg?.error);
          setProgressMsg(null);
          return;
        }

        // Extract-Trigger — Race-Pattern:
        // Ein reines `void fetch()` wird von React/Next abgebrochen,
        // wenn `router.refresh()` den Uploader neu mounted BEVOR
        // der HTTP-Request vollständig abgeschickt wurde. Ergebnis:
        // der Server sieht den Call NIE, der Doku bleibt auf 'pending'.
        //
        // Lösung: wir warten bis zu 3.5s auf den fetch — genug Zeit
        // dass der Request-Header rausgeht — und refreshen erst dann.
        // Der Server verarbeitet die 30-90s-Extraktion in Ruhe fertig,
        // Result via ocr_status in der DB.
        if (autoExtract) {
          console.log("[uploader] triggering extract for doc", reg.documentId);
          const extractPromise = fetch("/api/dd/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dd_project_id: projectId,
              document_id: reg.documentId,
            }),
            // keepalive: falls Seite navigiert wird bevor Request fertig,
            // bleibt der Request im Browser-Netzwerk-Stack aktiv.
            keepalive: true,
          }).catch((e) => {
            console.error("[uploader] extract fetch failed:", e);
            return null;
          });
          // Race: max 3.5s warten. Wenn der Server schneller ist,
          // super — wenn nicht, geht der Request im Hintergrund weiter.
          await Promise.race([
            extractPromise,
            new Promise((r) => setTimeout(r, 3500)),
          ]);
          console.log("[uploader] extract dispatch complete (may still be running server-side)");
        }

        setProgressMsg(null);
        setSuccessToast(t("dd.upload_success_toast"));
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
        // Nach oben scrollen — sonst sieht der User das Sticky-Widget
        // nicht, das oberhalb der Wizard-Steps sitzt.
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setTimeout(() => setSuccessToast(null), 4000);
      } catch (e) {
        setError(t("dd.upload_error_generic") + ": " + (e as Error).message);
        setProgressMsg(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1">
          {t("dd.doc_kind_label")}
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          disabled={uploading}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        >
          {(allowedKinds ?? ALL_KINDS).map((k) => (
            <option key={k} value={k}>
              {t(KIND_LABEL[k])}
            </option>
          ))}
        </select>
      </div>

      <label
        htmlFor="dd-doc-file"
        className={`block cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          uploading
            ? "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
            : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        }`}
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {progressMsg ?? t("dd.upload_hint")}
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.upload_size_hint")}
        </p>
      </label>
      <input
        ref={fileRef}
        id="dd-doc-file"
        type="file"
        accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png,image/webp,.doc,.docx"
        disabled={uploading}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {successToast && (
        <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-900 dark:text-green-200 flex items-center gap-2">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
}

function fileExt(name: string, mime: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  if (m) return m[1].toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}
