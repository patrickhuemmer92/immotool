"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { parseDecimal } from "@/lib/format";
import { setPropertyOwners, type OwnerShareState } from "./owner-share-actions";

export type OwnerOption = { id: string; name: string };

type Row = { owner_id: string; share: string };

type Props = {
  propertyId: string;
  owners: OwnerOption[];
  initial: { owner_id: string; ownership_share: number }[];
  readOnly: boolean;
};

export function OwnerShareEditor({
  propertyId,
  owners,
  initial,
  readOnly,
}: Props) {
  const t = useTranslations();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map((s) => ({
          owner_id: s.owner_id,
          share: formatPctInput(s.ownership_share * 100),
        }))
      : [{ owner_id: "", share: "" }]
  );

  const [state, formAction, pending] = useActionState<OwnerShareState, FormData>(
    setPropertyOwners.bind(null, propertyId),
    undefined
  );

  /** Sum is computed in percent (0..100). */
  const sumPct = useMemo(
    () =>
      rows.reduce((acc, r) => {
        const n = parseSharePct(r.share);
        return Number.isFinite(n) ? acc + n : acc;
      }, 0),
    [rows]
  );

  const sumOk = Math.abs(sumPct - 100) < 0.01;
  const hasDuplicates = useMemo(() => {
    const ids = rows.map((r) => r.owner_id).filter(Boolean);
    return new Set(ids).size !== ids.length;
  }, [rows]);

  const validRows = rows.filter(
    (r) => r.owner_id && parseSharePct(r.share) > 0
  );

  const canSubmit =
    !readOnly &&
    validRows.length > 0 &&
    sumOk &&
    !hasDuplicates &&
    validRows.length === rows.length;

  if (owners.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("properties.owners_no_owners")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({
          shares: validRows.map((r) => ({
            owner_id: r.owner_id,
            ownership_share: parseSharePct(r.share) / 100,
          })),
        })}
      />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("properties.owners_share_help")}
      </p>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <select
              value={row.owner_id}
              onChange={(e) => updateRow(idx, "owner_id", e.target.value)}
              disabled={readOnly}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">{t("properties.owners_select_owner")}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={row.share}
                onChange={(e) => updateRow(idx, "share", e.target.value)}
                placeholder="60"
                disabled={readOnly}
                className="w-28 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent pl-3 pr-8 py-2 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                %
              </span>
            </div>
            {!readOnly && rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-sm text-neutral-500 hover:text-red-600 px-2 py-2"
                aria-label="remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
        >
          {t("properties.owners_add_row")}
        </button>
      )}

      <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("properties.owners_share_sum")}:{" "}
          <strong
            className={
              sumOk
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {formatPctDisplay(sumPct)} %
          </strong>
        </span>
        {!readOnly && (
          <button
            type="submit"
            disabled={!canSubmit || pending}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? t("common.loading") : t("properties.owners_save")}
          </button>
        )}
      </div>

      {hasDuplicates && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("properties.owners_duplicate")}
        </p>
      )}
      {!sumOk && validRows.length > 0 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("properties.owners_share_invalid", {
            sum: formatPctDisplay(sumPct),
          })}
        </p>
      )}
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );

  function updateRow(idx: number, key: keyof Row, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { owner_id: "", share: "" }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
}

function parseSharePct(s: string): number {
  const n = parseDecimal(s);
  return n === null ? 0 : n;
}

function formatPctInput(n: number): string {
  return n.toLocaleString("de-DE", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatPctDisplay(n: number): string {
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
