import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { PortfolioDetailClient } from "./detail-client";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: portfolio }, { data: allProperties }] = await Promise.all([
    supabase
      .from("portfolios")
      .select(
        `id, name, description,
         portfolio_properties(property_id, added_at)`
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description, purchase_price")
      .eq("workspace_id", active.id)
      .order("city")
      .order("street"),
  ]);

  if (!portfolio) notFound();

  const editable = canEdit(active.role);
  const memberIds = new Set<string>(
    (portfolio.portfolio_properties as { property_id: string }[] | null)?.map(
      (m) => m.property_id
    ) ?? []
  );

  const members = (allProperties ?? [])
    .filter((p) => memberIds.has(p.id))
    .map((p) => ({
      id: p.id,
      address: formatPropertyAddress(p),
      purchase_price:
        p.purchase_price == null ? null : Number(p.purchase_price),
    }));
  const candidates = (allProperties ?? [])
    .filter((p) => !memberIds.has(p.id))
    .map((p) => ({ id: p.id, address: formatPropertyAddress(p) }));

  return (
    <div>
      <Link
        href="/portfolios"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("portfolios.title")}
      </Link>

      <PortfolioDetailClient
        portfolioId={portfolio.id}
        name={portfolio.name}
        description={portfolio.description}
        members={members}
        candidates={candidates}
        editable={editable}
      />
    </div>
  );
}
