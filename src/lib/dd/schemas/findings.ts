import { z } from "zod";
import { looseStringArray } from "./primitives";

/**
 * Konsolidierte Findings + Score-Modell.
 * Die LLM-Konsolidierung produziert Findings aus den strukturierten
 * Extraktions-Ergebnissen (NICHT aus Rohtext) — dadurch reproduzierbar.
 * Die eigentliche Score-Aggregation ist danach REGELBASIERT
 * (siehe src/lib/dd/scoring.ts), damit erklärbar.
 */

export const findingCategoryEnum = z.enum([
  "substanz",
  "finanzierung",
  "recht",
  "weg",
  "energie",
  "markt",
  "lage",
]);

export const findingSeverityEnum = z.enum(["high", "medium", "low", "positive"]);

export const findingCostHorizonEnum = z.enum(["short", "medium", "long"]);

export const consolidatedFindingSchema = z.object({
  category: findingCategoryEnum,
  severity: findingSeverityEnum,
  title: z.string(),
  description: z.string(),
  cost_min_eur: z.number().nullable(),
  cost_max_eur: z.number().nullable(),
  cost_horizon: findingCostHorizonEnum.nullable(),
  source_kind: z.enum([
    "expose", "weg_minutes", "wirtschaftsplan",
    "teilungserklaerung", "energieausweis", "grundriss",
    "market", "computed",
  ]),
  source_quote: z.string().nullable(),
  source_location: z.string().nullable(),
  /**
   * Bearbeitungsstand. Steuert, wie stark das Finding den Score noch
   * belastet — s. lib/dd/scoring.ts. `erledigt` verlangt einen BELEG;
   * eine muendliche Zusage ist `zu_belegen`.
   */
  status: z.enum(["offen", "zu_belegen", "erledigt"]).default("offen"),
  confidence: z.number().min(0).max(1),
  confidence_reason: z.string(),
  next_step: z.string(),
});

export const consolidationResultSchema = z.object({
  findings: z.array(consolidatedFindingSchema),
  questions: z.array(
    z.object({
      question: z.string(),
      addressed_to: z.enum(["makler", "verwalter", "verkaeufer", "bank", "andere"]),
      priority: z.enum(["high", "medium", "low"]),
      related_finding_titles: looseStringArray(),
    })
  ),
  negotiation_arguments: z.array(
    z.object({
      argument: z.string(),
      preisabschlag_eur_min: z.number().nullable(),
      preisabschlag_eur_max: z.number().nullable(),
      related_finding_titles: looseStringArray(),
    })
  ),
});

export type ConsolidatedFinding = z.infer<typeof consolidatedFindingSchema>;
export type ConsolidationResult = z.infer<typeof consolidationResultSchema>;
