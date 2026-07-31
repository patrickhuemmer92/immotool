"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { decimalToPercentInput, pct } from "@/lib/format";
import { FormError } from "@/components/form-error";
import { updateOwnerTaxRates, type FormState } from "./actions";
import { ownerTaxFieldName } from "./owner-tax-fields";

export type OwnerTaxRow = {
  id: string;
  name: string;
  kind: "person" | "group";
  /** Eigener Satz als Dezimalwert oder null = Workspace-Default. */
  tax_rate: number | null;
  /** Anzahl Objekte, an denen der Eigentümer beteiligt ist. */
  propertyCount: number;
};

/**
 * Steuersätze je Eigentümer. Ein leeres Feld heißt „kein eigener Satz" —
 * dann greift der Standard-Steuersatz des Workspace.
 */
export function OwnerTaxRatesForm({
  owners,
  fallbackRate,
  readOnly,
}: {
  owners: OwnerTaxRow[];
  fallbackRate: number;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateOwnerTaxRates,
    undefined
  );

  const fallbackLabel = pct(fallbackRate);

  if (owners.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("settings.owner_tax_empty")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={readOnly} className="space-y-3">
        {owners.map((o) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor={ownerTaxFieldName(o.id)}
                className="text-sm font-medium block truncate"
              >
                {o.name}
              </label>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {o.kind === "group"
                  ? t("settings.owner_tax_kind_group")
                  : t("settings.owner_tax_kind_person")}
                {" · "}
                {t("settings.owner_tax_properties", {
                  count: o.propertyCount,
                })}
              </p>
            </div>
            <div className="w-32">
              <input
                id={ownerTaxFieldName(o.id)}
                name={ownerTaxFieldName(o.id)}
                type="text"
                inputMode="decimal"
                placeholder={fallbackLabel}
                defaultValue={
                  o.tax_rate == null ? "" : decimalToPercentInput(o.tax_rate)
                }
                className={inputClass}
              />
            </div>
          </div>
        ))}
      </fieldset>

      <FormError raw={state?.error} />
      {state?.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {t("common.saved")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || readOnly}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("common.save")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";
