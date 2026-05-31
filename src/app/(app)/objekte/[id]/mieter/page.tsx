import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { TenantsClient, type TenantRow } from "./tenants-client";

export default async function PropertyTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: tenants }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select(
        "id, name, contract_start, is_fixed_term, contract_end, cold_rent_per_month, ancillary_costs_per_month, notes"
      )
      .eq("property_id", id)
      .order("contract_start", { ascending: false, nullsFirst: false }),
  ]);

  if (!property) notFound();
  const readOnly = !canEdit(active.role);

  const rows: TenantRow[] = (tenants ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    contract_start: row.contract_start ?? "",
    is_fixed_term: row.is_fixed_term ?? false,
    contract_end: row.contract_end ?? "",
    cold_rent_per_month:
      row.cold_rent_per_month == null
        ? ""
        : String(row.cold_rent_per_month).replace(".", ","),
    ancillary_costs_per_month:
      row.ancillary_costs_per_month == null
        ? ""
        : String(row.ancillary_costs_per_month).replace(".", ","),
    notes: row.notes ?? "",
  }));

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("tenants.title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("tenants.multi_tenant_help")}
      </p>

      <div className="mt-6">
        <TenantsClient
          propertyId={id}
          tenants={rows}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
