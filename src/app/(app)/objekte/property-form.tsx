"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { MoneyInput } from "@/components/money-input";
import { PercentInput } from "@/components/percent-input";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import {
  createProperty,
  updateProperty,
  type PropertyFormState,
} from "./actions";
import {
  PROPERTY_KINDS,
  type PropertyDefaults,
  type PropertyKind,
  buildAutoDescription,
} from "@/lib/properties";
import { parseDecimal } from "@/lib/format";

type Props = {
  defaults: PropertyDefaults;
  propertyId?: string;
  /** Top-level house entities the user can pick as parent. */
  parentCandidates: { id: string; label: string }[];
  /** Sum of all loan_amount values currently linked to this property — €. */
  loansSum?: number | null;
  readOnly: boolean;
};

type SplitMode = "eur" | "pct";

export function PropertyForm({
  defaults,
  propertyId,
  parentCandidates,
  loansSum,
  readOnly,
}: Props) {
  const t = useTranslations();
  const [kind, setKind] = useState<PropertyKind>(defaults.kind);

  // Q10 — live acquisition cost summary
  const [purchasePrice, setPurchasePrice] = useState<number | null>(parseDecimal(defaults.purchase_price));
  const [transferTax, setTransferTax] = useState<number | null>(parseDecimal(defaults.transfer_tax));
  const [brokerFee, setBrokerFee] = useState<number | null>(parseDecimal(defaults.broker_fee));
  const [notaryFee, setNotaryFee] = useState<number | null>(parseDecimal(defaults.notary_fee));
  const [registrationCost, setRegistrationCost] = useState<number | null>(parseDecimal(defaults.registration_cost));

  // M3 — equity for financing block
  const [equity, setEquity] = useState<number | null>(parseDecimal(defaults.equity_amount));

  // Q11 — €/% toggle for land + building values
  const [splitMode, setSplitMode] = useState<SplitMode>(() =>
    defaults.land_value && defaults.building_value_share_pct ? "eur" : "pct"
  );
  const [landValue, setLandValue] = useState<number | null>(parseDecimal(defaults.land_value));
  const [buildingPct, setBuildingPct] = useState<number | null>(parseDecimal(defaults.building_value_share_pct));

  // M6 — description auto/manual
  const [descAuto, setDescAuto] = useState<boolean>(defaults.description_auto);
  const [street, setStreet] = useState<string>(defaults.street);
  const [postalCode, setPostalCode] = useState<string>(defaults.postal_code);
  const [city, setCity] = useState<string>(defaults.city);
  const [locationDetail, setLocationDetail] = useState<string>(defaults.location_detail);
  const [descriptionManual, setDescriptionManual] = useState<string>(defaults.description);

  const autoDescription = useMemo(
    () => buildAutoDescription({ street, location_detail: locationDetail }),
    [street, locationDetail]
  );

  const acquisitionTotal = useMemo(
    () =>
      (purchasePrice ?? 0) +
      (transferTax ?? 0) +
      (brokerFee ?? 0) +
      (notaryFee ?? 0) +
      (registrationCost ?? 0),
    [purchasePrice, transferTax, brokerFee, notaryFee, registrationCost]
  );

  // Financing target: purchase_price - equity should match Σ loans
  const financingTarget = useMemo(() => {
    if (purchasePrice == null) return null;
    return purchasePrice - (equity ?? 0);
  }, [purchasePrice, equity]);
  const financingDiff = useMemo(() => {
    if (financingTarget == null || loansSum == null) return null;
    return Math.round((loansSum - financingTarget) * 100) / 100;
  }, [financingTarget, loansSum]);

  // €/% split derived values
  const buildingShareDecimal = buildingPct == null ? null : buildingPct / 100; // 0..1
  const buildingEur = useMemo(() => {
    if (splitMode === "eur") {
      if (purchasePrice == null || landValue == null) return null;
      return Math.max(0, purchasePrice - landValue);
    }
    if (purchasePrice == null || buildingShareDecimal == null) return null;
    return purchasePrice * buildingShareDecimal;
  }, [splitMode, purchasePrice, landValue, buildingShareDecimal]);
  const landEur = useMemo(() => {
    if (splitMode === "eur") return landValue;
    if (purchasePrice == null || buildingShareDecimal == null) return null;
    return purchasePrice * (1 - buildingShareDecimal);
  }, [splitMode, purchasePrice, landValue, buildingShareDecimal]);
  const buildingPctDerived = useMemo(() => {
    if (splitMode === "pct") return buildingPct;
    if (purchasePrice == null || purchasePrice === 0 || buildingEur == null) return null;
    return (buildingEur / purchasePrice) * 100;
  }, [splitMode, buildingPct, buildingEur, purchasePrice]);
  const splitSumPct = useMemo(() => {
    if (splitMode === "pct" && buildingPct != null) {
      // user picks building share; land = 100 - that
      return 100;
    }
    if (purchasePrice && landValue != null && buildingEur != null && purchasePrice > 0) {
      return ((landValue + buildingEur) / purchasePrice) * 100;
    }
    return null;
  }, [splitMode, buildingPct, landValue, buildingEur, purchasePrice]);

  const action = propertyId
    ? updateProperty.bind(null, propertyId)
    : createProperty;
  const [state, formAction, pending] = useActionState<
    PropertyFormState,
    FormData
  >(action, undefined);

  const canHaveParent = kind !== "house";

  // Hidden values for submit: land_value and building_value_share_pct
  // are always derived to keep the server schema unchanged.
  const submitBuildingPct = splitMode === "eur" ? buildingPctDerived : buildingPct;
  const submitLandValue = splitMode === "eur" ? landValue : landEur;

  return (
    <form action={formAction} className="space-y-8 max-w-3xl">
      <fieldset disabled={readOnly} className="space-y-8">
        <Section title={t("properties.section_type")}>
          <div>
            <label className="text-sm font-medium block mb-2">
              {t("properties.kind_label")}
            </label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={
                    "px-3 py-1.5 rounded-lg border text-sm transition-colors " +
                    (kind === k
                      ? "border-accent bg-accent text-accent-foreground font-medium"
                      : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
                  }
                >
                  {t(`properties.kind_${k}`)}
                </button>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
          </div>

          {canHaveParent && parentCandidates.length > 0 && (
            <Field
              id="parent_property_id"
              label={t("properties.parent_property")}
              hint={t("properties.parent_property_help")}
            >
              <select
                id="parent_property_id"
                name="parent_property_id"
                defaultValue={defaults.parent_property_id}
                className={inputClass}
              >
                <option value="">{t("properties.parent_none")}</option>
                {parentCandidates
                  .filter((p) => p.id !== propertyId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {!canHaveParent && (
            <input type="hidden" name="parent_property_id" value="" />
          )}
        </Section>

        <Section title={t("properties.section_address")}>
          <div className="mb-4">
            <AddressAutocomplete
              onPick={(parts) => {
                if (parts.street) setStreet(parts.street);
                if (parts.postal_code) setPostalCode(parts.postal_code);
                if (parts.city) setCity(parts.city);
              }}
            />
          </div>
          <Grid>
            <Field id="street" label={t("properties.street")} required>
              <input
                id="street"
                name="street"
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field id="postal_code" label={t("properties.postal_code")} required>
                <input
                  id="postal_code"
                  name="postal_code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
              <div className="col-span-2">
                <Field id="city" label={t("properties.city")} required>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
            <Field id="location_detail" label={t("properties.location_detail")}>
              <input
                id="location_detail"
                name="location_detail"
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="description" label={t("properties.description")}>
              <div className="space-y-2">
                <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDescAuto(true)}
                    className={
                      "px-3 py-1.5 " +
                      (descAuto
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
                    }
                  >
                    {t("properties.description_mode_auto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescAuto(false)}
                    className={
                      "px-3 py-1.5 border-l border-neutral-300 dark:border-neutral-700 " +
                      (!descAuto
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
                    }
                  >
                    {t("properties.description_mode_manual")}
                  </button>
                </div>
                <input type="hidden" name="description_auto" value={descAuto ? "true" : "false"} />
                {descAuto ? (
                  <>
                    <input
                      type="hidden"
                      name="description"
                      value={autoDescription}
                    />
                    <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {autoDescription || t("properties.description_auto_preview")}
                    </div>
                  </>
                ) : (
                  <input
                    id="description"
                    name="description"
                    type="text"
                    value={descriptionManual}
                    onChange={(e) => setDescriptionManual(e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
            </Field>
            <Field id="unit_number" label={t("properties.unit_number")}>
              <input
                id="unit_number"
                name="unit_number"
                type="text"
                defaultValue={defaults.unit_number}
                className={inputClass}
              />
            </Field>
            <Field id="sqm" label={t("properties.sqm")}>
              <input
                id="sqm"
                name="sqm"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.sqm}
                className={inputClass}
              />
            </Field>
          </Grid>
        </Section>

        <Section title={t("properties.section_dates")}>
          <Grid>
            <Field id="notary_appointment" label={t("properties.notary_appointment")}>
              <input
                id="notary_appointment"
                name="notary_appointment"
                type="date"
                defaultValue={defaults.notary_appointment}
                className={inputClass}
              />
            </Field>
            <Field id="transfer_date" label={t("properties.transfer_date")}>
              <input
                id="transfer_date"
                name="transfer_date"
                type="date"
                defaultValue={defaults.transfer_date}
                className={inputClass}
              />
            </Field>
            <Field id="registration_date" label={t("properties.registration_date")}>
              <input
                id="registration_date"
                name="registration_date"
                type="date"
                defaultValue={defaults.registration_date}
                className={inputClass}
              />
            </Field>
          </Grid>
        </Section>

        <Section title={t("properties.section_acquisition_costs")}>
          <Grid>
            <Field id="purchase_price" label={t("properties.purchase_price")}>
              <MoneyInput
                id="purchase_price"
                name="purchase_price"
                defaultValue={defaults.purchase_price}
                onValueChange={setPurchasePrice}
              />
            </Field>
            <Field id="transfer_tax" label={t("properties.transfer_tax")}>
              <MoneyInput
                id="transfer_tax"
                name="transfer_tax"
                defaultValue={defaults.transfer_tax}
                onValueChange={setTransferTax}
              />
            </Field>
            <Field id="broker_fee" label={t("properties.broker_fee")}>
              <MoneyInput
                id="broker_fee"
                name="broker_fee"
                defaultValue={defaults.broker_fee}
                onValueChange={setBrokerFee}
              />
            </Field>
            <Field id="notary_fee" label={t("properties.notary_fee")}>
              <MoneyInput
                id="notary_fee"
                name="notary_fee"
                defaultValue={defaults.notary_fee}
                onValueChange={setNotaryFee}
              />
            </Field>
            <Field id="registration_cost" label={t("properties.registration_cost")}>
              <MoneyInput
                id="registration_cost"
                name="registration_cost"
                defaultValue={defaults.registration_cost}
                onValueChange={setRegistrationCost}
              />
            </Field>
            <Field
              id="funding_cost"
              label={t("properties.funding_cost")}
              hint={t("properties.funding_cost_help")}
            >
              <MoneyInput
                id="funding_cost"
                name="funding_cost"
                defaultValue={defaults.funding_cost}
              />
            </Field>
          </Grid>

          <div className="mt-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 px-4 py-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {t("properties.acquisition_total")}
            </span>
            <span className="font-semibold tabular-nums">
              {acquisitionTotal.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </Section>

        <Section title={t("properties.section_financing")}>
          <Grid>
            <Field id="equity_amount" label={t("properties.equity_amount")}>
              <MoneyInput
                id="equity_amount"
                name="equity_amount"
                defaultValue={defaults.equity_amount}
                onValueChange={setEquity}
              />
            </Field>
            {loansSum != null && (
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {t("properties.loans_sum_label")}
                </div>
                <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm tabular-nums">
                  {loansSum.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            )}
          </Grid>

          {financingTarget != null && (
            <div className="mt-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 px-4 py-2 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span>{t("properties.financing_target")}</span>
                <span className="font-medium tabular-nums">
                  {financingTarget.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {loansSum != null && financingDiff != null && (
                <div
                  className={
                    "text-xs " +
                    (Math.abs(financingDiff) < 0.5
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400")
                  }
                >
                  {Math.abs(financingDiff) < 0.5
                    ? t("properties.financing_match_ok")
                    : t("properties.financing_match_warn", {
                        diff: financingDiff.toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 2,
                        }),
                      })}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title={t("properties.section_valuation_inputs")}>
          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => setSplitMode("eur")}
              className={
                "px-3 py-1.5 " +
                (splitMode === "eur"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
              }
            >
              {t("properties.value_split_mode_eur")}
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("pct")}
              className={
                "px-3 py-1.5 border-l border-neutral-300 dark:border-neutral-700 " +
                (splitMode === "pct"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
              }
            >
              {t("properties.value_split_mode_pct")}
            </button>
          </div>

          <Grid>
            {splitMode === "eur" ? (
              <>
                <Field id="land_value_input" label={t("properties.land_value")}>
                  <MoneyInput
                    id="land_value_input"
                    name="land_value"
                    defaultValue={defaults.land_value}
                    onValueChange={setLandValue}
                  />
                </Field>
                <Field
                  id="building_value_display"
                  label={t("properties.building_value")}
                  hint={
                    buildingPctDerived != null
                      ? `${buildingPctDerived.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
                      : undefined
                  }
                >
                  <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm tabular-nums">
                    {buildingEur != null
                      ? buildingEur.toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </div>
                </Field>
                <input
                  type="hidden"
                  name="building_value_share_pct"
                  value={submitBuildingPct == null ? "" : String(submitBuildingPct)}
                />
              </>
            ) : (
              <>
                <Field
                  id="building_pct_input"
                  label={t("properties.building_value_share_pct")}
                >
                  <PercentInput
                    id="building_pct_input"
                    name="building_value_share_pct"
                    defaultValue={defaults.building_value_share_pct}
                    onValueChange={setBuildingPct}
                  />
                </Field>
                <Field
                  id="land_pct_display"
                  label={t("properties.land_value_pct")}
                  hint={
                    landEur != null
                      ? landEur.toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 2,
                        })
                      : undefined
                  }
                >
                  <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm tabular-nums">
                    {buildingPct != null
                      ? `${(100 - buildingPct).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
                      : "—"}
                  </div>
                </Field>
                <input
                  type="hidden"
                  name="land_value"
                  value={submitLandValue == null ? "" : String(submitLandValue)}
                />
              </>
            )}
            <Field id="depreciation_rate" label={t("properties.depreciation_rate")}>
              <PercentInput
                id="depreciation_rate"
                name="depreciation_rate"
                defaultValue={defaults.depreciation_rate}
              />
            </Field>
          </Grid>

          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t("properties.value_split_help")}
          </p>
          {splitMode === "eur" && splitSumPct != null && Math.abs(splitSumPct - 100) > 0.1 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {t("properties.value_split_mismatch", {
                sum: splitSumPct.toLocaleString("de-DE", { maximumFractionDigits: 1 }),
              })}
            </p>
          )}
        </Section>

        <Section title={t("properties.section_meta")}>
          <Field id="notes" label={t("properties.notes")}>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={defaults.notes}
              className={inputClass}
            />
          </Field>
        </Section>

        <FormError raw={state?.error} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending
              ? t("common.loading")
              : propertyId
                ? t("common.save")
                : t("common.create")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
