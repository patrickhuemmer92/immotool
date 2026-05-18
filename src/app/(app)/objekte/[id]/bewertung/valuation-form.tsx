"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { parseDecimal } from "@/lib/format";
import {
  createValuation,
  updateValuation,
  type ValuationState,
} from "./actions";

const WEIGHT_PRESETS = [0, 0.25, 0.5, 0.75, 1] as const;

export type ValuationDefaults = {
  valuation_date: string;
  condition_score: string;
  market_rent_per_sqm: string;
  multiple: string;
  building_value: string;
  /** Optionaler Bodenwert-Override pro Bewertung. Leer = Property-Wert. */
  land_value: string;
  income_weight: number;
};

export function ValuationForm({
  propertyId,
  valuationId,
  propertyLandValue,
  defaults,
}: {
  propertyId: string;
  valuationId?: string;
  /**
   * Bodenwert aus den Property-Stammdaten — wird als Default in das
   * Bewertungs-eigene Bodenwert-Feld vorgeladen.
   */
  propertyLandValue: number | null;
  defaults?: ValuationDefaults;
}) {
  const t = useTranslations();
  const today = new Date().toISOString().slice(0, 10);
  const initial: ValuationDefaults = defaults ?? {
    valuation_date: today,
    condition_score: "",
    market_rent_per_sqm: "",
    multiple: "",
    building_value: "",
    land_value: "",
    income_weight: 0.5,
  };
  const action = valuationId
    ? updateValuation.bind(null, valuationId, propertyId)
    : createValuation.bind(null, propertyId);
  const [state, formAction, pending] = useActionState<ValuationState, FormData>(
    action,
    undefined
  );
  const [incomeWeight, setIncomeWeight] = useState<number>(
    initial.income_weight
  );
  const [buildingValue, setBuildingValue] = useState<number | null>(
    parseDecimal(initial.building_value)
  );
  // Bewertungs-Bodenwert: explizit gepflegt > Property-Default.
  const initialLandValueParsed = parseDecimal(initial.land_value);
  const [landValueLocal, setLandValueLocal] = useState<number | null>(
    initialLandValueParsed ?? propertyLandValue
  );

  const eurFmt = (n: number) =>
    n.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  const substanzwert =
    landValueLocal != null && buildingValue != null
      ? landValueLocal + buildingValue
      : null;
  const landIsOverride =
    landValueLocal != null &&
    propertyLandValue != null &&
    Math.abs(landValueLocal - propertyLandValue) > 0.005;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field id="valuation_date" label={t("valuation.valuation_date")}>
          <input
            id="valuation_date"
            name="valuation_date"
            type="date"
            defaultValue={initial.valuation_date}
            required
            className={inputClass}
          />
        </Field>
        <Field
          id="condition_score"
          label={t("valuation.condition_score")}
          help={t("valuation.help_condition")}
        >
          <input
            id="condition_score"
            name="condition_score"
            type="number"
            min={1}
            max={10}
            defaultValue={initial.condition_score}
            className={inputClass}
          />
        </Field>
        <Field
          id="market_rent_per_sqm"
          label={t("valuation.market_rent_per_sqm")}
          help={t("valuation.help_market_rent")}
        >
          <input
            id="market_rent_per_sqm"
            name="market_rent_per_sqm"
            type="text"
            inputMode="decimal"
            placeholder="z. B. 9,50"
            defaultValue={initial.market_rent_per_sqm}
            className={inputClass}
          />
        </Field>
        <Field
          id="multiple"
          label={t("valuation.multiple")}
          help={t("valuation.help_multiple")}
        >
          <input
            id="multiple"
            name="multiple"
            type="text"
            inputMode="decimal"
            placeholder="z. B. 22"
            defaultValue={initial.multiple}
            className={inputClass}
          />
        </Field>
        <Field
          id="building_value"
          label={t("valuation.building_value")}
          help={t("valuation.help_building_value")}
        >
          <input
            id="building_value"
            name="building_value"
            type="text"
            inputMode="decimal"
            defaultValue={initial.building_value}
            onChange={(e) => setBuildingValue(parseDecimal(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-4 text-sm space-y-3">
        <div>
          <label
            htmlFor="land_value"
            className="text-sm font-medium block mb-1"
          >
            {t("valuation.land_value_input_label")}
          </label>
          <input
            id="land_value"
            name="land_value"
            type="text"
            inputMode="decimal"
            placeholder={
              propertyLandValue != null
                ? eurFmt(propertyLandValue)
                : "z. B. 50.000"
            }
            defaultValue={initial.land_value}
            onChange={(e) => {
              const parsed = parseDecimal(e.target.value);
              setLandValueLocal(parsed ?? propertyLandValue);
            }}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
            {t("valuation.land_value_input_help")}
          </p>
          {propertyLandValue != null && (
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {t("valuation.land_value_default_hint", {
                value: eurFmt(propertyLandValue),
              })}
              {" — "}
              <Link
                href={`/objekte/${propertyId}/bearbeiten`}
                className="underline hover:text-accent"
              >
                {t("valuation.land_value_edit_link")}
              </Link>
            </p>
          )}
          {landIsOverride && (
            <p className="mt-1 text-[11px] text-accent">
              {t("valuation.land_value_override_active")}
            </p>
          )}
          {propertyLandValue == null && landValueLocal == null && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              {t("valuation.no_land_value_warning")}
            </p>
          )}
        </div>

        {substanzwert != null && (
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between font-semibold tabular-nums">
            <span>{t("valuation.substanzwert_total")}</span>
            <span>{eurFmt(substanzwert)}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <input type="hidden" name="income_weight" value={incomeWeight} />
        <label className="text-sm font-medium block mb-2">
          {t("valuation.weighting")}
        </label>
        <div className="flex flex-wrap gap-2">
          {WEIGHT_PRESETS.map((w) => {
            const active = Math.abs(w - incomeWeight) < 0.001;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setIncomeWeight(w)}
                className={
                  "rounded-lg px-3 py-1.5 text-sm border " +
                  (active
                    ? "bg-accent text-accent-foreground border-transparent"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800")
                }
              >
                {Math.round(w * 100)}% {t("valuation.ertragswert")} /{" "}
                {Math.round((1 - w) * 100)}% {t("valuation.sachwert")}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          {t("valuation.weighting_help")}
        </p>
      </div>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? t("common.loading")
          : valuationId
            ? t("common.save")
            : t("valuation.new")}
      </button>

      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug pt-2 border-t border-neutral-200 dark:border-neutral-800">
        {t("valuation.source_footnote")}
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium block mb-1">
        {label}
      </label>
      {children}
      {help && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
          {help}
        </p>
      )}
    </div>
  );
}
