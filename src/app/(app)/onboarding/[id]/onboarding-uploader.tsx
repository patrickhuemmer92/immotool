"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerOnboardingDocument } from "../actions";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

type Kind =
  | "kaufvertrag"
  | "mietvertrag"
  | "darlehensvertrag"
  | "grundbuchauszug"
  | "other";

export function OnboardingUploader({
  workspaceId,
  projectId,
  defaultKind = "kaufvertrag",
}: {
  workspaceId: string;
  projectId: string;
  defaultKind?: Kind;
}) {
  const t = useTranslations();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [uploading, startUpload] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setProgress(null);

    if (file.size > MAX_BYTES) {
      setError(t("onb.upload_error_too_large"));
      return;
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      setError(t("onb.upload_error_bad_type"));
      return;
    }

    startUpload(async () => {
      try {
        setProgress(t("onb.uploading"));
        // Pfad-Präfix `onboarding` innerhalb desselben dd-documents-Buckets
        const ext = fileExt(file.name, file.type);
        const path = `${workspaceId}/onboarding/${projectId}/${crypto.randomUUID()}.${ext}`;

        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("dd-documents")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (upErr) {
          setError(t("onb.upload_error_generic") + ": " + upErr.message);
          setProgress(null);
          return;
        }

        const reg = await registerOnboardingDocument({
          onboarding_project_id: projectId,
          kind,
          filename: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (reg?.error || !reg?.documentId) {
          setError(t("onb.upload_error_register") + ": " + reg?.error);
          setProgress(null);
          return;
        }

        // Race-Trigger — analog zum DD-Uploader. `void fetch()` würde
        // durch router.refresh() abgebrochen bevor der Request rausgeht.
        console.log("[onb-uploader] triggering extract for doc", reg.documentId);
        const extractPromise = fetch("/api/onboarding/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onboarding_project_id: projectId,
            document_id: reg.documentId,
          }),
          keepalive: true,
        }).catch((e) => {
          console.error("[onb-uploader] extract fetch failed:", e);
          return null;
        });
        await Promise.race([
          extractPromise,
          new Promise((r) => setTimeout(r, 3500)),
        ]);
        console.log("[onb-uploader] extract dispatch complete");

        setProgress(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (e) {
        setError(t("onb.upload_error_generic") + ": " + (e as Error).message);
        setProgress(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1">
          {t("onb.doc_kind_label")}
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          disabled={uploading}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value="kaufvertrag">{t("onb.kind_kaufvertrag")}</option>
          <option value="mietvertrag">{t("onb.kind_mietvertrag")}</option>
          <option value="darlehensvertrag">
            {t("onb.kind_darlehensvertrag")}
          </option>
          <option value="grundbuchauszug">{t("onb.kind_grundbuchauszug")}</option>
          <option value="other">{t("onb.kind_other")}</option>
        </select>
      </div>

      <label
        htmlFor="onb-file"
        className="block cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 px-4 py-6 text-center hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {progress ?? t("onb.upload_hint")}
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("onb.upload_size_hint")}
        </p>
      </label>
      <input
        ref={fileRef}
        id="onb-file"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        disabled={uploading}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
