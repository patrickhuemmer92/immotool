"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addOtherDepreciationItem, type AfaItemState } from "./actions";

export function AfaItemForm({ propertyId }: { propertyId: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AfaItemState, FormData>(
    addOtherDepreciationItem.bind(null, propertyId),
    undefined
  );

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("afa.item_name")}
          </label>
          <input name="item_name" type="text" required className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("afa.acquisition_date")}
          </label>
          <input
            name="acquisition_date"
            type="date"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("afa.acquisition_cost")}
          </label>
          <input
            name="acquisition_cost"
            type="text"
            inputMode="decimal"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("afa.duration_years")}
          </label>
          <input
            name="duration_years"
            type="number"
            min={1}
            required
            className={inputClass}
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("afa.add_item")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";
