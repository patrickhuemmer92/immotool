import { renderToStream } from "@react-pdf/renderer";
import { fetchPropertyForPdf } from "@/lib/pdf/data";
import { resolveLocale } from "@/lib/pdf/translate";
import { FactsheetDocument } from "@/components/pdf/FactsheetDocument";
import { getActiveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ propertyId: string }> }
) {
  const { propertyId } = await ctx.params;
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("lang"));

  const active = await getActiveWorkspace();
  if (!active) return new Response("unauthorized", { status: 401 });

  const data = await fetchPropertyForPdf(propertyId, active.id);
  if (!data) return new Response("not found", { status: 404 });

  const stream = await renderToStream(
    FactsheetDocument({ data, locale }) as never
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factsheet-${propertyId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
