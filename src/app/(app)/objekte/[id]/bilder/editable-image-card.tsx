"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { updatePropertyImage, deletePropertyImage } from "./image-actions";

const CATEGORIES = [
  "exterior",
  "living_room",
  "bathroom",
  "kitchen",
  "bedroom",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

export function EditableImageCard({
  imageId,
  propertyId,
  url,
  initialCategory,
  initialCaption,
  editable,
}: {
  imageId: string;
  propertyId: string;
  url: string | undefined;
  initialCategory: Category;
  initialCaption: string;
  editable: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [caption, setCaption] = useState(initialCaption);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCategory(initialCategory);
    setCaption(initialCaption);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePropertyImage(imageId, propertyId, {
        category,
        caption,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(t("common.confirm_delete"))) return;
    startTransition(async () => {
      await deletePropertyImage(imageId, propertyId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 group">
      <div className="relative aspect-square">
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={initialCaption || ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
            —
          </div>
        )}

        {editable && !editing && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              className="rounded-full bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 disabled:opacity-50"
              aria-label={t("common.edit")}
              title={t("common.edit")}
            >
              ✎
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-full bg-black/60 hover:bg-red-600 text-white text-xs px-2 py-1 disabled:opacity-50"
              aria-label={t("images.delete")}
              title={t("images.delete")}
            >
              ×
            </button>
          </div>
        )}

        {!editing && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-xs text-white/80">
              {t(`images.category_${initialCategory}`)}
            </p>
            {initialCaption && (
              <p className="text-xs text-white truncate">{initialCaption}</p>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="p-3 space-y-2 bg-white dark:bg-neutral-900">
          <div>
            <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
              {t("images.category")}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={pending}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`images.category_${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
              {t("images.caption")}
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={pending}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.loading") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setEditing(false);
              }}
              disabled={pending}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
