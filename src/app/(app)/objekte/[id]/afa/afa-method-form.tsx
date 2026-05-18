"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { MoneyInput } from "@/components/money-input";
import {
  updateDepreciationMethod,
  type DepMethodState,
} from "./actions";
import type { DepreciationMethod } from "@/lib/calculations/depreciation";

const METHODS: DepreciationMethod[] = ["linear", "degressive_7v", "sonder_7b"];

export function AfaMethodForm({
  propertyId,
  defaults,
  readOnly,
}: {
  propertyId: string;
  defaults: {
    depreciation_method: DepreciationMethod;
    depreciation_start_year: string;
    sonder_7b_basis_limit: string;
  };
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [method, setMethod] = useState<DepreciationMethod>(
    defaults.depreciation_method
  );
  const [state, formAction, pending] = useActionState<DepMethodState, FormData>(
    updateDepreciationMethod.bind(null, propertyId),
    undefined
  );

  return (
    <form action={formAction} className="space-y-4 max-w-3xl">
      <fieldset disabled={readOnly} className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">
            {t("afa.method_label")}
          </label>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={
                  "px-3 py-1.5 rounded-lg border text-sm transition-colors " +
                  (method === m
                    ? "border-accent bg-accent text-accent-foreground font-medium"
                    : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
                }
              >
                {t(`afa.method_${m}`)}
              </button>
            ))}
          </div>
          <input type="hidden" name="depreciation_method" value={method} />
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
            {t(`afa.method_${method}_help`)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="depreciation_start_year"
              className="text-sm font-medium block mb-1"
            >
              {t("afa.start_year")}
            </label>
            <input
              id="depreciation_start_year"
              name="depreciation_start_year"
              type="number"
              min="1900"
              max="2200"
              defaultValue={defaults.depreciation_start_year}
              placeholder={t("afa.start_year_placeholder")}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {t("afa.start_year_help")}
            </p>
          </div>

          {method === "sonder_7b" && (
            <div>
              <label
                htmlFor="sonder_7b_basis_limit"
                className="text-sm font-medium block mb-1"
              >
                {t("afa.sonder_basis_limit")}
              </label>
              <MoneyInput
                id="sonder_7b_basis_limit"
                name="sonder_7b_basis_limit"
                defaultValue={defaults.sonder_7b_basis_limit}
              />
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                {t("afa.sonder_basis_limit_help")}
              </p>
            </div>
          )}
          {method !== "sonder_7b" && (
            <input type="hidden" name="sonder_7b_basis_limit" value="" />
          )}
        </div>

        <FormError raw={state?.error} />
        {state?.success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("common.saved")}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("common.loading") : t("common.save")}
        </button>
      </fieldset>
    </form>
  );
}
