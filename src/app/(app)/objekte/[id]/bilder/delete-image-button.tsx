"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { deletePropertyImage } from "./image-actions";

export function DeleteImageButton({
  imageId,
  propertyId,
}: {
  imageId: string;
  propertyId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("common.confirm_delete"))) return;
        startTransition(async () => {
          await deletePropertyImage(imageId, propertyId);
          router.refresh();
        });
      }}
      className="absolute top-2 right-2 rounded-full bg-black/60 hover:bg-red-600 text-white text-xs px-2 py-1 disabled:opacity-50"
      aria-label={t("images.delete")}
    >
      ×
    </button>
  );
}
