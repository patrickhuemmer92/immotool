import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { DeleteTenantButton } from "./delete-tenant-button";

/**
 * Workspace-weite Mieter-Übersicht.
 *
 * Da pro Objekt genau ein Mietvertrag existiert (unique constraint auf
 * property_id), brauchen wir keine Sortierung/Filter — die Liste ist
 * 1:1 die Liste der vermieteten Objekte. Bearbeiten + Löschen direkt in
 * der Zeile, Neuanlegen über das jeweilige Objekt.
 */
export default async function TenantsOverviewPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  // Wir lesen aus properties + nested tenants (inner join), damit wir die
  // Objekt-Adresse direkt mitbekommen — und nur Objekte mit Mieter zeigen.
  const { data: rows } = await supabase
    .from("properties")
    .select(
      `id, street, postal_code, city, location_detail, description,
       tenants!inner(id, name, cold_rent_per_month, ancillary_costs_per_month,
                     contract_start, contract_end, is_fixed_term)`
    )
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  type TenantRow = {
    id: string;
    name: string;
    cold_rent_per_month: string | number | null;
    ancillary_costs_per_month: string | number | null;
    contract_start: string | null;
    contract_end: string | null;
    is_fixed_term: boolean;
  };

  const editable = canEdit(active.role);

  const tenants =
    (rows ?? [])
      .map((p) => {
        const t = (p.tenants as unknown as TenantRow[] | TenantRow | null);
        const row = Array.isArray(t) ? t[0] : t;
        if (!row) return null;
        return {
          propertyId: p.id,
          propertyAddress: formatPropertyAddress(p),
          tenant: row,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("tenants.title")}
        </h1>
      </div>

      <div className="mt-6">
        {tenants.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("tenants.empty_list")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("properties.section_address")}</Th>
                  <Th>{t("tenants.name")}</Th>
                  <Th className="text-right">
                    {t("tenants.cold_rent_per_month")}
                  </Th>
                  <Th className="text-right">{t("tenants.gross_rent")}</Th>
                  <Th>{t("tenants.contract_start")}</Th>
                  <Th>{t("tenants.term_type")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(({ propertyId, propertyAddress, tenant }) => {
                  const cold = num(tenant.cold_rent_per_month);
                  const anc = num(tenant.ancillary_costs_per_month);
                  const gross =
                    cold === null && anc === null ? null : (cold ?? 0) + (anc ?? 0);
                  return (
                    <tr
                      key={tenant.id}
                      className="border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <Td>
                        <Link
                          href={`/objekte/${propertyId}`}
                          className="hover:underline text-neutral-700 dark:text-neutral-300"
                        >
                          {propertyAddress}
                        </Link>
                      </Td>
                      <Td className="font-medium">{tenant.name}</Td>
                      <Td className="tabular-nums text-right">
                        {formatCurrency(cold)}
                      </Td>
                      <Td className="tabular-nums text-right">
                        {formatCurrency(gross)}
                      </Td>
                      <Td>{formatDate(tenant.contract_start)}</Td>
                      <Td>
                        <TermBadge
                          fixed={tenant.is_fixed_term}
                          endsAt={tenant.contract_end}
                          fixedLabel={t("tenants.term_fixed")}
                          openLabel={t("tenants.term_open_ended")}
                          untilLabel={t("tenants.term_until")}
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/objekte/${propertyId}/mieter`}
                            className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline whitespace-nowrap"
                          >
                            {t("common.edit")} →
                          </Link>
                          {editable && (
                            <DeleteTenantButton propertyId={propertyId} />
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function TermBadge({
  fixed,
  endsAt,
  fixedLabel,
  openLabel,
  untilLabel,
}: {
  fixed: boolean;
  endsAt: string | null;
  fixedLabel: string;
  openLabel: string;
  untilLabel: string;
}) {
  if (!fixed) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">
        {openLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
      {fixedLabel}
      {endsAt && (
        <span className="text-amber-700/80 dark:text-amber-300/80">
          {untilLabel} {formatDate(endsAt)}
        </span>
      )}
    </span>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-2 align-middle ${className ?? ""}`}>{children}</td>
  );
}
