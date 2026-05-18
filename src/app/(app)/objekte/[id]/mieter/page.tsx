import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import {
  RentalContractsList,
  type RentalContractRow,
} from "./rental-contracts-list";

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
  const [{ data: property }, { data: contracts }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("rental_contracts")
      .select(
        "id, tenant_name, contract_start, is_fixed_term, contract_end, cold_rent_per_month, notes"
      )
      .eq("property_id", id)
      .order("contract_start", { ascending: false }),
  ]);

  if (!property) notFound();

  const readOnly = !canEdit(active.role);

  const rows: RentalContractRow[] = (contracts ?? []).map((c) => ({
    id: c.id,
    tenant_name: c.tenant_name,
    contract_start: c.contract_start,
    is_fixed_term: c.is_fixed_term ?? false,
    contract_end: c.contract_end ?? null,
    cold_rent_per_month:
      c.cold_rent_per_month == null ? null : Number(c.cold_rent_per_month),
    notes: c.notes ?? null,
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
        {t("tenants.timeline_help")}
      </p>

      <div className="mt-6">
        <RentalContractsList
          propertyId={id}
          contracts={rows}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
