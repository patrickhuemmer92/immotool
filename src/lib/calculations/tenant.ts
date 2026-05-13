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

/** Per-factor weight. Missing entries default to 1 — i.e. unweighted. */
export type TenantScoreWeights = Partial<Record<TenantScoreField, number>>;

export const DEFAULT_TENANT_SCORE_WEIGHTS: Record<TenantScoreField, number> = {
  family_status: 1,
  schufa: 1,
  rental_duration: 1,
  personal_impression: 1,
  employment_status: 1,
  income_level: 1,
};

/**
 * Weighted average of all set score fields (1..5). null/undefined values are
 * ignored — they neither contribute to the sum nor to the weight divisor.
 * Returns null when nothing is filled.
 *
 * Pass `weights` to bias factors. Equal weights (or omitted) reproduce the
 * previous simple-average behavior.
 */
export function tenantScore(
  t: TenantScores,
  weights: TenantScoreWeights = {}
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const f of TENANT_SCORE_FIELDS) {
    const v = t[f];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const w = weights[f] ?? 1;
    if (w <= 0) continue;
    weightedSum += v * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
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

/**
 * Coerce a value from `settings.tenant_score_weights` (DB JSONB) into a clean
 * weights object. Missing or invalid entries fall back to 1.
 */
export function readTenantScoreWeights(
  value: unknown
): Record<TenantScoreField, number> {
  const out = { ...DEFAULT_TENANT_SCORE_WEIGHTS };
  if (!value || typeof value !== "object") return out;
  for (const f of TENANT_SCORE_FIELDS) {
    const raw = (value as Record<string, unknown>)[f];
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n >= 0) out[f] = n;
  }
  return out;
}
