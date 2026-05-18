"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BankViewResult, PnLResult } from "@/lib/calculations/pnl";
import {
  CashflowResultCard,
  type LtvContext,
  type SnapshotKPIs,
} from "./cashflow-result-card";
import { SnapshotForm } from "./snapshot-form";
import type { SnapshotDefaults } from "./snapshot-defaults";

/**
 * Single-snapshot wrapper that toggles between the read-only result card
 * and an inline edit form pre-filled with the stored values. Owning state
 * client-side avoids passing render-prop functions across the RSC boundary
 * (which Next.js forbids).
 */
export function SnapshotItem({
  propertyId,
  snapshotId,
  defaults,
  canEdit,
  // CashflowResultCard props passed straight through:
  periodStart,
  periodEnd,
  investor,
  bank,
  bankStressed,
  kpis,
  ltvContext,
  rateLockUntil,
  deleteSlot,
}: {
  propertyId: string;
  snapshotId: string;
  defaults: SnapshotDefaults;
  canEdit: boolean;
  periodStart: string;
  periodEnd: string;
  investor: PnLResult;
  bank: BankViewResult;
  bankStressed: BankViewResult;
  kpis: SnapshotKPIs;
  ltvContext?: LtvContext;
  rateLockUntil: string | null;
  /** Pre-rendered delete form / button (already a Server-Action JSX node). */
  deleteSlot?: React.ReactNode;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold mb-4">{t("pnl.edit_snapshot")}</h3>
        <SnapshotForm
          propertyId={propertyId}
          snapshotId={snapshotId}
          defaults={defaults}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <CashflowResultCard
      periodStart={periodStart}
      periodEnd={periodEnd}
      investor={investor}
      bank={bank}
      bankStressed={bankStressed}
      kpis={kpis}
      ltvContext={ltvContext}
      rateLockUntil={rateLockUntil}
      onEdit={
        canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-700 dark:text-neutral-300 hover:underline"
          >
            {t("common.edit")}
          </button>
        ) : null
      }
      onDelete={deleteSlot}
    />
  );
}
