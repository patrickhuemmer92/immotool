"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SnapshotForm, type SnapshotDefaults } from "./snapshot-form";

/**
 * Client wrapper around a single cashflow snapshot: in view mode it renders
 * the children (the read-only result card); in edit mode it swaps to the
 * SnapshotForm pre-filled with this snapshot's stored values.
 */
export function SnapshotItem({
  propertyId,
  snapshotId,
  defaults,
  children,
  canEdit,
}: {
  propertyId: string;
  snapshotId: string;
  defaults: SnapshotDefaults;
  children: (editButton: React.ReactNode) => React.ReactNode;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold mb-4">
          {t("pnl.edit_snapshot")}
        </h3>
        <SnapshotForm
          propertyId={propertyId}
          snapshotId={snapshotId}
          defaults={defaults}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const editButton = canEdit ? (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-neutral-700 dark:text-neutral-300 hover:underline"
    >
      {t("common.edit")}
    </button>
  ) : null;

  return <>{children(editButton)}</>;
}
