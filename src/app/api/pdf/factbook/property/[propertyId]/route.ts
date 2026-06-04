import { renderToStream } from "@react-pdf/renderer";
import { fetchPropertyForPdf } from "@/lib/pdf/data";
import { resolveLocale } from "@/lib/pdf/translate";
import { FactbookDocument } from "@/components/pdf/FactbookDocument";
import { getActiveWorkspace } from "@/lib/workspace";
import { requirePremiumOrLock } from "@/lib/billing/gate";

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

  // Premium-Gate: Factbook ist ein Premium-Feature.
  const gate = await requirePremiumOrLock(active.id);
  if (gate.locked) {
    return new Response("premium_required", { status: 402 });
  }

  const data = await fetchPropertyForPdf(propertyId, active.id);
  if (!data) return new Response("not found", { status: 404 });

  const stream = await renderToStream(
    FactbookDocument({ data, locale }) as never
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factbook-${propertyId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
