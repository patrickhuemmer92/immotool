"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import {
  createSimulation,
  updateSimulation,
  type SimulationFormState,
} from "./actions";

export type SimulationDefaults = {
  property_id: string;
  name: string;
  description: string;
  rent_growth_pa: string;
  cost_growth_pa: string;
  interest_change_bps: string;
};

export function SimulationForm({
  simulationId,
  defaults,
  properties,
  onCancel,
}: {
  simulationId?: string;
  defaults: SimulationDefaults;
  /** Auswahl-Optionen für das Objekt — leer wenn schon zugewiesen. */
  properties: { id: string; label: string }[];
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const action = simulationId
    ? updateSimulation.bind(null, simulationId)
    : createSimulation;
  const [state, formAction, pending] = useActionState<
    SimulationFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      {/* Objekt-Auswahl: bei Create wählen, bei Edit als Hidden durchreichen */}
      {simulationId ? (
        <input type="hidden" name="property_id" value={defaults.property_id} />
      ) : (
        <div>
          <label htmlFor="property_id" className={labelClass}>
            {t("simulations.property")}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="property_id"
            name="property_id"
            required
            defaultValue={defaults.property_id}
            className={inputClass}
          >
            <option value="">{t("simulations.choose_property")}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>
          {t("simulations.name")}
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults.name}
          placeholder={t("simulations.name_placeholder")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          {t("simulations.description")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaults.description}
          placeholder={t("simulations.description_placeholder")}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="rent_growth_pa" className={labelClass}>
            {t("simulations.rent_growth")}
          </label>
          <input
            id="rent_growth_pa"
            name="rent_growth_pa"
            type="text"
            inputMode="decimal"
            placeholder="2"
            defaultValue={defaults.rent_growth_pa}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {t("simulations.rent_growth_help")}
          </p>
        </div>
        <div>
          <label htmlFor="cost_growth_pa" className={labelClass}>
            {t("simulations.cost_growth")}
          </label>
          <input
            id="cost_growth_pa"
            name="cost_growth_pa"
            type="text"
            inputMode="decimal"
            placeholder="3"
            defaultValue={defaults.cost_growth_pa}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {t("simulations.cost_growth_help")}
          </p>
        </div>
        <div>
          <label htmlFor="interest_change_bps" className={labelClass}>
            {t("simulations.interest_change")}
          </label>
          <input
            id="interest_change_bps"
            name="interest_change_bps"
            type="text"
            inputMode="numeric"
            placeholder="200"
            defaultValue={defaults.interest_change_bps}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {t("simulations.interest_change_help")}
          </p>
        </div>
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
            : simulationId
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
const labelClass = "text-sm font-medium block mb-1";
