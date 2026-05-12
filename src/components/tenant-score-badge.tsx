import { tenantScoreBand } from "@/lib/calculations/tenant";

export function TenantScoreBadge({
  score,
  size = "sm",
}: {
  score: number | null;
  size?: "sm" | "lg";
}) {
  const band = tenantScoreBand(score);
  const padding = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums ${padding}`}
      style={{
        backgroundColor: `${band.color}26`,
        color: band.color,
      }}
      title={band.label}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: band.color }}
      />
      {score === null
        ? "—"
        : score.toLocaleString("de-DE", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
          })}
    </span>
  );
}
