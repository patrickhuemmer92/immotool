import { useTranslations } from "next-intl";

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
  return (
    <span className="inline-flex flex-col items-start">
      <span className={`${cls} font-bold tracking-tight`}>
        {t("app.name_prefix")}
        <span className="text-accent">{t("app.name_suffix")}</span>
      </span>
      {tagline && (
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mt-1">
          {t("app.tagline")}
        </span>
      )}
    </span>
  );
}
