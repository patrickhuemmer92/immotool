"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { dateDe } from "@/lib/format";
import {
  RentalContractForm,
  type RentalContractDefaults,
  EMPTY_RENTAL_CONTRACT_DEFAULTS,
} from "./rental-contract-form";
import { deleteRentalContract } from "./rental-contract-actions";

export type RentalContractRow = {
  id: string;
  tenant_name: string;
  contract_start: string;
  is_fixed_term: boolean;
  contract_end: string | null;
  cold_rent_per_month: number | null;
  notes: string | null;
};

export function RentalContractsList({
  propertyId,
  contracts,
  readOnly,
}: {
  propertyId: string;
  contracts: RentalContractRow[];
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {contracts.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("tenants.empty_contracts")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr className="text-left">
                <Th>{t("tenants.name")}</Th>
                <Th>{t("tenants.contract_start")}</Th>
                <Th>{t("tenants.contract_end")}</Th>
                <Th>{t("tenants.term_type")}</Th>
                <Th right>{t("tenants.cold_rent_per_month")}</Th>
                {!readOnly && <Th></Th>}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <RentalContractRowView
                  key={c.id}
                  propertyId={propertyId}
                  contract={c}
                  readOnly={readOnly}
                  editing={editId === c.id}
                  onEdit={() => setEditId(c.id)}
                  onClose={() => setEditId(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && !addOpen && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          + {t("tenants.add_contract")}
        </button>
      )}

      {!readOnly && addOpen && (
        <RentalContractForm
          propertyId={propertyId}
          defaults={EMPTY_RENTAL_CONTRACT_DEFAULTS}
          readOnly={false}
          onCancel={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function RentalContractRowView({
  propertyId,
  contract: c,
  readOnly,
  editing,
  onEdit,
  onClose,
}: {
  propertyId: string;
  contract: RentalContractRow;
  readOnly: boolean;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();

  if (editing) {
    const defaults: RentalContractDefaults = {
      tenant_name: c.tenant_name,
      contract_start: c.contract_start,
      is_fixed_term: c.is_fixed_term,
      contract_end: c.contract_end ?? "",
      cold_rent_per_month:
        c.cold_rent_per_month == null
          ? ""
          : c.cold_rent_per_month.toString().replace(".", ","),
      notes: c.notes ?? "",
    };
    return (
      <tr>
        <td colSpan={6} className="p-3">
          <RentalContractForm
            propertyId={propertyId}
            contractId={c.id}
            defaults={defaults}
            readOnly={false}
            onCancel={onClose}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-200 dark:border-neutral-800">
      <Td>{c.tenant_name}</Td>
      <Td>{dateDe(c.contract_start)}</Td>
      <Td>{c.contract_end ? dateDe(c.contract_end) : "—"}</Td>
      <Td>
        {c.is_fixed_term ? t("tenants.term_fixed") : t("tenants.term_open_ended")}
      </Td>
      <Td right>
        {c.cold_rent_per_month == null
          ? "—"
          : c.cold_rent_per_month.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
      </Td>
      {!readOnly && (
        <Td>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onEdit}
              className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
            >
              {t("common.edit")}
            </button>
            <form action={deleteRentalContract.bind(null, c.id, propertyId)}>
              <button
                type="submit"
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                {t("common.delete")}
              </button>
            </form>
          </div>
        </Td>
      )}
    </tr>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td className={`px-3 py-2 align-middle ${right ? "text-right" : ""}`}>
      {children}
    </td>
  );
}
