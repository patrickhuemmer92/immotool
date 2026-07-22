"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerDdDocument } from "../document-actions";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = [
  "application/pdf",
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
  | "other";

export function DocumentUploader({
  workspaceId,
  projectId,
  defaultKind = "expose",
  autoExtract = true,
}: {
  workspaceId: string;
  projectId: string;
  defaultKind?: Kind;
  /** Nach Upload sofort Extraktion starten. */
  autoExtract?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [uploading, startUpload] = useTransition();
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
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

        if (autoExtract) {
          setProgressMsg(t("dd.extracting"));
          const res = await fetch("/api/dd/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dd_project_id: projectId,
              document_id: reg.documentId,
            }),
          });
          if (!res.ok) {
            const errJson = await res
              .json()
              .catch(() => ({ error: "unknown" }));
            setError(
              t("dd.extract_error") + ": " + (errJson?.error ?? res.statusText)
            );
            setProgressMsg(null);
            return;
          }
        }

        setProgressMsg(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
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
          <option value="expose">{t("dd.doc_kind_expose")}</option>
          <option value="weg_minutes">{t("dd.doc_kind_weg")}</option>
          <option value="wirtschaftsplan">{t("dd.doc_kind_budget")}</option>
          <option value="teilungserklaerung">{t("dd.doc_kind_teilung")}</option>
          <option value="energieausweis">{t("dd.doc_kind_energie")}</option>
          <option value="grundriss">{t("dd.doc_kind_grundriss")}</option>
          <option value="other">{t("dd.doc_kind_other")}</option>
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
        accept="application/pdf,image/jpeg,image/png,image/webp"
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
