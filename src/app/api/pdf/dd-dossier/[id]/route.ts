import { renderToStream } from "@react-pdf/renderer";
import { getActiveWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  DdDossierDocument,
  type DdDossierData,
} from "@/components/pdf/DdDossierDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Finding = DdDossierData["findings"][number];
type Question = DdDossierData["questions"][number];
type NegotiationArg = DdDossierData["negotiationArgs"][number];
type CategoryScore = DdDossierData["scoreByCategory"][string];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const active = await getActiveWorkspace();
  if (!active) return new Response("unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("dd_projects")
    .select(
      "id, name, address_hint, extracted_expose, score_overall, score_confidence, score_by_category, analyzed_at"
    )
    .eq("id", id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) return new Response("not found", { status: 404 });

  const { data: findingsRaw } = await supabase
    .from("dd_findings")
    .select(
      "category, severity, title, description, cost_min, cost_max, source_quote, source_location, confidence, next_step"
    )
    .eq("dd_project_id", id)
    .order("severity", { ascending: false });

  const exp = (project.extracted_expose ?? {}) as {
    street?: string | null;
    postal_code?: string | null;
    city?: string | null;
    purchase_price_eur?: number | null;
    living_area_sqm?: number | null;
  };

  const scoreCat = (project.score_by_category ?? {}) as Record<
    string,
    (CategoryScore & { _meta?: unknown }) | unknown
  >;
  const meta = scoreCat._meta as
    | { questions?: Question[]; negotiation_arguments?: NegotiationArg[] }
    | undefined;

  // _meta aus scoreByCategory abtrennen — im PDF zeigen wir nur die
  // reinen Kategorie-Scores.
  const byCategory: Record<string, CategoryScore> = {};
  for (const [k, v] of Object.entries(scoreCat)) {
    if (k === "_meta") continue;
    const cs = v as { score?: number; ampel?: "green" | "yellow" | "red" };
    if (typeof cs.score === "number" && cs.ampel) {
      byCategory[k] = { score: cs.score, ampel: cs.ampel };
    }
  }

  const addressLine = [
    exp.street,
    [exp.postal_code, exp.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ") || project.address_hint || "";

  const data: DdDossierData = {
    projectName: project.name,
    addressLine,
    purchasePriceEur: exp.purchase_price_eur ?? null,
    livingAreaSqm: exp.living_area_sqm ?? null,
    scoreOverall: project.score_overall,
    scoreConfidence: project.score_confidence == null ? null : Number(project.score_confidence),
    scoreByCategory: byCategory,
    findings: (findingsRaw ?? []) as Finding[],
    questions: meta?.questions ?? [],
    negotiationArgs: meta?.negotiation_arguments ?? [],
    computedAt: project.analyzed_at ?? new Date().toISOString(),
  };

  const stream = await renderToStream(DdDossierDocument({ data }) as never);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dossier-${id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
