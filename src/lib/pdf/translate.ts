import deMessages from "../../../messages/de.json";
import enMessages from "../../../messages/en.json";

export type PdfLocale = "de" | "en";

const dictionaries: Record<PdfLocale, Record<string, unknown>> = {
  de: deMessages,
  en: enMessages,
};

export function loadDict(locale: PdfLocale): (key: string, params?: Record<string, string | number>) => string {
  const dict = dictionaries[locale];
  return (key, params) => {
    const parts = key.split(".");
    let cur: unknown = dict;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    if (typeof cur !== "string") return key;
    if (!params) return cur;
    return cur.replace(/\{(\w+)\}/g, (_, k) =>
      params[k] != null ? String(params[k]) : `{${k}}`
    );
  };
}

export function resolveLocale(value?: string | null): PdfLocale {
  return value === "en" ? "en" : "de";
}
