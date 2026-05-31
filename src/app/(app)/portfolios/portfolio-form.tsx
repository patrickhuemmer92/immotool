"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import {
  createPortfolio,
  updatePortfolio,
  type PortfolioFormState,
} from "./actions";

export type PortfolioDefaults = { name: string; description: string };

export function PortfolioForm({
  portfolioId,
  defaults,
  onCancel,
}: {
  /** Wenn gesetzt: Update-Mode. */
  portfolioId?: string;
  defaults: PortfolioDefaults;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const action = portfolioId
    ? updatePortfolio.bind(null, portfolioId)
    : createPortfolio;
  const [state, formAction, pending] = useActionState<
    PortfolioFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
      <div>
        <label htmlFor="name" className="text-sm font-medium block mb-1">
          {t("portfolios.name")}
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults.name}
          placeholder={t("portfolios.name_placeholder")}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="text-sm font-medium block mb-1"
        >
          {t("portfolios.description")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description}
          placeholder={t("portfolios.description_placeholder")}
          className={inputClass}
        />
      </div>

      <FormError raw={state?.error} />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? t("common.loading")
            : portfolioId
              ? t("common.save")
              : t("common.create")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";
