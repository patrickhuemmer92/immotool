export const TENANT_SCORE_FIELDS = [
  "family_status",
  "schufa",
  "rental_duration",
  "personal_impression",
  "employment_status",
  "income_level",
] as const;

export type TenantScoreField = (typeof TENANT_SCORE_FIELDS)[number];

export type TenantScores = Partial<Record<TenantScoreField, number | null>>;

/**
 * Mittelwert über alle gesetzten Score-Felder (1-5). null/undefined ignoriert.
 * Gibt null zurück, wenn kein Feld gesetzt ist.
 */
export function tenantScore(t: TenantScores): number | null {
  const vals = TENANT_SCORE_FIELDS.map((f) => t[f]).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Liefert eine farb- und labelfähige Bandbreite für einen Score 1..5. */
export function tenantScoreBand(score: number | null): {
  label: "low" | "medium" | "high" | "unknown";
  color: string;
} {
  if (score === null) return { label: "unknown", color: "#9ca3af" };
  if (score >= 4) return { label: "high", color: "#10b981" };
  if (score >= 3) return { label: "medium", color: "#f59e0b" };
  return { label: "low", color: "#ef4444" };
}
