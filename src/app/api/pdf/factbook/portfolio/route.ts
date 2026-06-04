import { renderToStream } from "@react-pdf/renderer";
import { fetchPropertyForPdf } from "@/lib/pdf/data";
import { resolveLocale } from "@/lib/pdf/translate";
import { PortfolioFactbookDocument } from "@/components/pdf/PortfolioFactbookDocument";
import { getActiveWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { requirePremiumOrLock } from "@/lib/billing/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("lang"));
  const portfolioId = url.searchParams.get("portfolioId");

  const active = await getActiveWorkspace();
  if (!active) return new Response("unauthorized", { status: 401 });

  // Premium-Gate: Factbook ist ein Premium-Feature.
  const gate = await requirePremiumOrLock(active.id);
  if (gate.locked) {
    return new Response("premium_required", { status: 402 });
  }

  const supabase = await createClient();

  // Wenn Portfolio gewählt: erst Name/Owner-Check, dann nur Properties
  // aus der Join-Tabelle holen. Sonst Standard: alle Workspace-Objekte.
  let workspaceName = active.name;
  let propertyIds: string[] = [];

  if (portfolioId) {
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select(
        `id, name, workspace_id,
         portfolio_properties(property_id)`
      )
      .eq("id", portfolioId)
      .maybeSingle();
    if (!portfolio || portfolio.workspace_id !== active.id) {
      return new Response("not_found", { status: 404 });
    }
    workspaceName = `${active.name} — ${portfolio.name}`;
    propertyIds = (
      (portfolio.portfolio_properties as { property_id: string }[] | null) ?? []
    ).map((m) => m.property_id);
  } else {
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("workspace_id", active.id)
      .order("city")
      .order("street");
    propertyIds = (properties ?? []).map((p) => p.id);
  }

  const propertyDataList = await Promise.all(
    propertyIds.map((id) => fetchPropertyForPdf(id, active.id))
  );
  const filtered = propertyDataList.filter(
    (d): d is NonNullable<typeof d> => d != null
  );

  const stream = await renderToStream(
    PortfolioFactbookDocument({
      workspaceName,
      properties: filtered,
      locale,
    }) as never
  );

  const filenameSuffix = portfolioId ? `portfolio-${portfolioId}` : active.id;
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factbook-${filenameSuffix}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
