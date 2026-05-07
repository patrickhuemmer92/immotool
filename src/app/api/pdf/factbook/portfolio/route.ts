import { renderToStream } from "@react-pdf/renderer";
import { fetchPropertyForPdf } from "@/lib/pdf/data";
import { resolveLocale } from "@/lib/pdf/translate";
import { PortfolioFactbookDocument } from "@/components/pdf/PortfolioFactbookDocument";
import { getActiveWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("lang"));

  const active = await getActiveWorkspace();
  if (!active) return new Response("unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  const propertyDataList = await Promise.all(
    (properties ?? []).map((p) => fetchPropertyForPdf(p.id, active.id))
  );
  const filtered = propertyDataList.filter(
    (d): d is NonNullable<typeof d> => d != null
  );

  const stream = await renderToStream(
    PortfolioFactbookDocument({
      workspaceName: active.name,
      properties: filtered,
      locale,
    }) as never
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="portfolio-${active.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
