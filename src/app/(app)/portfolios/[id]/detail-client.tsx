"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PortfolioForm } from "../portfolio-form";
import {
  addPropertyToPortfolio,
  deletePortfolio,
  removePropertyFromPortfolio,
} from "../actions";

type Member = {
  id: string;
  address: string;
  purchase_price: number | null;
};

type Candidate = {
  id: string;
  address: string;
};

/**
 * Client-Wrapper für die Portfolio-Detail-Seite. Hält den Edit-Modus für
 * Name/Beschreibung, das Property-Add-Dropdown und die Remove-Action.
 *
 * Member-Liste + Kandidaten kommen vom Server (bereits gefiltert) — der
 * Client fasst lediglich die UI zusammen, die zu viele Stateful-Pieces
 * für reine Server Components hätte.
 */
export function PortfolioDetailClient({
  portfolioId,
  name,
  description,
  members,
  candidates,
  editable,
}: {
  portfolioId: string;
  name: string;
  description: string | null;
  members: Member[];
  candidates: Candidate[];
  editable: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<string>("");
  const [pendingAdd, startAdd] = useTransition();
  const [pendingRemove, startRemove] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (!adding) return;
    setError(null);
    startAdd(async () => {
      const fd = new FormData();
      fd.set("portfolio_id", portfolioId);
      fd.set("property_id", adding);
      const result = await addPropertyToPortfolio(undefined, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setAdding("");
        router.refresh();
      }
    });
  }

  async function onRemove(propertyId: string) {
    if (!confirm(t("portfolios.confirm_remove"))) return;
    startRemove(async () => {
      await removePropertyFromPortfolio(portfolioId, propertyId);
      router.refresh();
    });
  }

  async function onDelete() {
    if (!confirm(t("portfolios.confirm_delete"))) return;
    startDelete(async () => {
      await deletePortfolio(portfolioId);
    });
  }

  const totalPurchase = members.reduce(
    (acc, m) => acc + (m.purchase_price ?? 0),
    0
  );

  if (editing) {
    return (
      <div className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          {t("portfolios.edit")}
        </h1>
        <PortfolioForm
          portfolioId={portfolioId}
          defaults={{ name, description: description ?? "" }}
          onCancel={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {description && (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/pdf/factbook/portfolio?portfolioId=${portfolioId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t("portfolios.download_factbook")}
          </a>
          {editable && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pendingDelete}
                className="rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
              >
                {pendingDelete ? t("common.loading") : t("common.delete")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl">
        <Kpi
          label={t("portfolios.kpi_count")}
          value={String(members.length)}
        />
        <Kpi
          label={t("portfolios.kpi_purchase_total")}
          value={eur(totalPurchase)}
        />
      </div>

      {editable && (
        <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 max-w-2xl">
          <h2 className="text-sm font-semibold mb-3">
            {t("portfolios.add_property")}
          </h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("portfolios.no_candidates")}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                disabled={pendingAdd}
                className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">{t("portfolios.choose_property")}</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.address}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAdd}
                disabled={!adding || pendingAdd}
                className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {pendingAdd ? t("common.loading") : t("common.create")}
              </button>
            </div>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">
          {t("portfolios.members_section")}
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("portfolios.no_members")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("properties.section_address")}</Th>
                  <Th className="text-right">
                    {t("properties.purchase_price")}
                  </Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td className="font-medium">{m.address}</Td>
                    <Td className="tabular-nums text-right">
                      {m.purchase_price == null ? "—" : eur(m.purchase_price)}
                    </Td>
                    <Td>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => onRemove(m.id)}
                          disabled={pendingRemove}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          {t("portfolios.remove")}
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-sm tabular-nums">{value}</div>
    </div>
  );
}

function eur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
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
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-2 align-middle ${className ?? ""}`}>{children}</td>
  );
}
