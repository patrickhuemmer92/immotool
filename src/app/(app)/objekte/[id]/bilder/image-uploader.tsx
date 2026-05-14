"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImageCropModal } from "@/components/image-crop-modal";
import { insertPropertyImage } from "./image-actions";

const CATEGORIES = [
  "exterior",
  "living_room",
  "bathroom",
  "kitchen",
  "bedroom",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Pending = {
  file: File;
  objectUrl: string;
};

export function ImageUploader({
  workspaceId,
  propertyId,
}: {
  workspaceId: string;
  propertyId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>("exterior");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Queue of files to process one-by-one through the crop modal.
  const [queue, setQueue] = useState<Pending[]>([]);
  const current = queue[0] ?? null;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("images.category")}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`images.category_${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1">
            {t("images.caption")}
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="image-file"
          className="block cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 px-4 py-8 text-center hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {pending ? t("images.uploading") : t("images.drag_drop")}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t("images.max_size")}
          </p>
        </label>
        <input
          ref={fileRef}
          id="image-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={pending}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {current && (
        <ImageCropModal
          open
          src={current.objectUrl}
          filename={current.file.name}
          aspect={4 / 3}
          onConfirm={(cropped) => {
            uploadSingle(cropped);
            advanceQueue();
          }}
          onSkip={() => {
            uploadSingle(current.file);
            advanceQueue();
          }}
          onClose={() => {
            advanceQueue();
          }}
        />
      )}
    </div>
  );

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const validated: Pending[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        setError(`Unsupported type: ${file.type}`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`File too large: ${file.name}`);
        continue;
      }
      validated.push({ file, objectUrl: URL.createObjectURL(file) });
    }
    setQueue((q) => [...q, ...validated]);

    if (fileRef.current) fileRef.current.value = "";
  }

  function advanceQueue() {
    setQueue((q) => {
      const [done, ...rest] = q;
      if (done) URL.revokeObjectURL(done.objectUrl);
      return rest;
    });
  }

  function uploadSingle(file: File) {
    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const path = `${workspaceId}/${propertyId}/${filename}`;

      const { error: upErr } = await supabase.storage
        .from("property-images")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upErr) {
        setError(upErr.message);
        return;
      }

      const result = await insertPropertyImage({
        property_id: propertyId,
        storage_path: path,
        category,
        caption: caption || undefined,
      });
      if (result?.error) {
        setError(result.error);
        await supabase.storage.from("property-images").remove([path]);
        return;
      }
      router.refresh();
    });
  }
}
