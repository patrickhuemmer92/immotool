"use client";

import { useTranslations } from "next-intl";
import { errorToTranslationKey } from "@/lib/form-errors";

/**
 * Standard error renderer for form fields. Pass in the raw error from a
 * server action (`state?.error`); this resolves it to a localized message.
 *
 * Resolution-Reihenfolge (defensiv, damit MISSING_MESSAGE-Bugs nicht den
 * eigentlichen Fehler verschlucken):
 *   1) Translation-Key auflösen.
 *   2) Wenn Key fehlt / next-intl wirft -> Raw-Text anzeigen.
 *   3) Wenn die Translation den Key 1:1 zurückgibt (next-intl bei MISSING
 *      in Production), behandeln wir das wie einen Fehlschlag und nutzen
 *      ebenfalls den Raw-Text.
 */
export function FormError({ raw }: { raw?: string }) {
  const t = useTranslations();
  if (!raw) return null;
  const { key, params } = errorToTranslationKey(raw);

  let message: string = raw;
  try {
    const translated = t(key, params);
    // next-intl gibt im Default-Modus den Key-Namen zurück, wenn er fehlt.
    // Das wollen wir nicht als Fehlertext zeigen — lieber den Raw-Text.
    if (translated && translated !== key) {
      message = translated;
    }
  } catch {
    // bleibt bei message = raw
  }

  return (
    <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
  );
}
