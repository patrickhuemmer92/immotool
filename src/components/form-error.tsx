"use client";

import { useTranslations } from "next-intl";
import { errorToTranslationKey } from "@/lib/form-errors";

/**
 * Standard error renderer for form fields. Pass in the raw error from a
 * server action (`state?.error`); this resolves it to a localized message.
 */
export function FormError({ raw }: { raw?: string }) {
  const t = useTranslations();
  if (!raw) return null;
  const { key, params } = errorToTranslationKey(raw);
  // next-intl throws if a key is missing — fall back to the raw text so the
  // user still sees *something* meaningful.
  let message: string;
  try {
    message = t(key, params);
  } catch {
    message = raw;
  }
  return (
    <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
  );
}
