"use client";

import { useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  src: string;
  filename: string;
  /** Aspect ratio (e.g. 4/3). Pass undefined for free-form. */
  aspect?: number;
  onConfirm: (croppedFile: File) => void | Promise<void>;
  onSkip: () => void;
  onClose: () => void;
};

export function ImageCropModal({
  open,
  src,
  filename,
  aspect = 4 / 3,
  onConfirm,
  onSkip,
  onClose,
}: Props) {
  const t = useTranslations();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop | null>(null);
  const [working, setWorking] = useState(false);

  if (!open) return null;

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initial = aspect
      ? centerCrop(
          makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
          width,
          height
        )
      : ({ unit: "%", x: 5, y: 5, width: 90, height: 90 } as Crop);
    setCrop(initial);
  }

  async function applyCrop() {
    if (!imgRef.current || !completed || completed.width === 0) {
      onSkip();
      return;
    }
    setWorking(true);
    try {
      const file = await cropToFile(imgRef.current, completed, filename);
      await onConfirm(file);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-base font-semibold">{t("images.crop_title")}</h3>
        </div>

        <div className="p-5 overflow-auto bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center min-h-[20rem]">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompleted(c)}
            aspect={aspect}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImageLoad}
              className="max-h-[60vh] w-auto"
            />
          </ReactCrop>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={working}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {t("images.crop_skip")}
          </button>
          <button
            type="button"
            onClick={applyCrop}
            disabled={working}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {working ? t("common.loading") : t("images.crop_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Crop an HTMLImageElement based on a PixelCrop (rendered-space pixels) and
 * return a real File (re-encoded as JPEG for now — broad browser support and
 * smaller payloads than PNG).
 */
async function cropToFile(
  img: HTMLImageElement,
  crop: PixelCrop,
  filename: string
): Promise<File> {
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return await new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("blob_failed"));
          return;
        }
        // Force JPEG so the resulting file is reasonably small.
        const base = filename.replace(/\.[^.]+$/, "");
        resolve(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}
