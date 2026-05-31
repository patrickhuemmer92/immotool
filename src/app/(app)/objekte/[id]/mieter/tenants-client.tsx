"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { TenantForm, EMPTY_TENANT_DEFAULTS, type TenantDefaults } from "./tenant-form";
import { deleteTenant } from "./actions";

export type TenantRow = TenantDefaults & { id: string };

/**
 * Multi-Tenant-UI je Objekt:
 *   - Listet alle Mietverträge mit Inline-Edit + Delete
 *   - Globales "+ Neuer Mietvertrag"-CTA klappt das Anlege-Form auf
 *
 * Single-Tenant-Sonderfall: Hat das Objekt nur einen Vertrag, sieht es
 * praktisch genauso aus wie früher — eine Zeile, Edit-Button öffnet das
 * vertraute Formular. WGs / mehrere Verträge → weitere Zeilen.
 */
export function TenantsClient({
  propertyId,
  tenants,
  readOnly,
}: {
  propertyId: string;
  tenants: TenantRow[];
  readOnly: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onDelete(tenantId: string) {
    if (!confirm(t("common.confirm_delete"))) return;
    start(async () => {
      await deleteTenant(tenantId, propertyId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {tenants.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("tenants.empty_property")}
        </p>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => {
            const isEditing = editingId === tenant.id;
            if (isEditing) {
              return (
                <div
                  key={tenant.id}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
                >
                  <h3 className="text-sm font-semibold mb-4">
                    {t("tenants.edit")}
                  </h3>
                  <TenantForm
                    propertyId={propertyId}
                    tenantId={tenant.id}
                    defaults={tenant}
                    readOnly={readOnly}
                    onCancel={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                  />
                </div>
              );
            }
            return (
              <TenantSummary
                key={tenant.id}
                tenant={tenant}
                readOnly={readOnly}
                pending={pending}
                onEdit={() => setEditingId(tenant.id)}
                onDelete={() => onDelete(tenant.id)}
              />
            );
          })}
        </div>
      )}

      {!readOnly && (
        <div>
          {adding ? (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <h3 className="text-sm font-semibold mb-4">
                {t("tenants.new")}
              </h3>
              <TenantForm
                propertyId={propertyId}
                defaults={EMPTY_TENANT_DEFAULTS}
                readOnly={readOnly}
                onCancel={() => {
                  setAdding(false);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              + {t("tenants.new")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TenantSummary({
  tenant,
  readOnly,
  pending,
  onEdit,
  onDelete,
}: {
  tenant: TenantRow;
  readOnly: boolean;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const cold = parseGermanNumber(tenant.cold_rent_per_month);
  const anc = parseGermanNumber(tenant.ancillary_costs_per_month);
  const gross = (cold ?? 0) + (anc ?? 0);
  const active = isActive(tenant);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {tenant.name}
            {!active && (
              <span className="ml-2 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5">
                {t("tenants.status_expired")}
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {tenant.is_fixed_term
              ? t("tenants.term_fixed_until", {
                  date: formatDate(tenant.contract_end) ?? "—",
                })
              : t("tenants.term_open_ended")}
            {tenant.contract_start && (
              <>
                {" · "}
                {t("tenants.term_since", {
                  date: formatDate(tenant.contract_start) ?? "—",
                })}
              </>
            )}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <KV
          label={t("tenants.cold_rent_per_month")}
          value={formatCurrency(cold)}
        />
        <KV
          label={t("tenants.ancillary_costs_per_month")}
          value={formatCurrency(anc)}
        />
        <KV label={t("tenants.gross_rent")} value={formatCurrency(gross)} />
      </dl>
      {tenant.notes && (
        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
          {tenant.notes}
        </p>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 tabular-nums">{value}</dd>
    </div>
  );
}

function parseGermanNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isActive(t: TenantRow): boolean {
  if (!t.is_fixed_term) return true;
  if (!t.contract_end) return true;
  return t.contract_end >= new Date().toISOString().slice(0, 10);
}
