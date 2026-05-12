import { useTranslations } from "next-intl";

/**
 * Brand wordmark. The "A" in "Ably" is replaced with a teal caret glyph
 * (`/\`), tying the wordmark together with the favicon and accent color.
 */
export function Wordmark({
  size = "md",
  tagline = false,
}: {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
}) {
  const t = useTranslations();
  const cls =
    size === "sm"
      ? "text-base"
      : size === "lg"
        ? "text-3xl"
        : "text-xl";
  const suffix = t("app.name_suffix");
  // "Ably" → "A" (replaced by glyph) + "bly".
  const head = suffix.slice(0, 1);
  const tail = suffix.slice(1);

  return (
    <span className="inline-flex flex-col items-start">
      <span className={`${cls} font-bold tracking-tight inline-flex items-baseline`}>
        {t("app.name_prefix")}
        <span className="text-accent inline-flex items-baseline" aria-label={head}>
          <CaretGlyph size={size} />
          {tail}
        </span>
      </span>
      {tagline && (
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mt-1">
          {t("app.tagline")}
        </span>
      )}
    </span>
  );
}

function CaretGlyph({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = size === "sm" ? 12 : size === "lg" ? 24 : 16;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={{ verticalAlign: "baseline", transform: "translateY(1px)" }}
    >
      <path
        d="M2 13 L8 3 L14 13"
        fill="none"
        stroke="currentColor"
        strokeWidth={size === "lg" ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
