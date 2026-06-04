"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  /** Owners available for assignment (only used in create mode). */
  availableOwners?: { id: string; name: string }[];
  readOnly: boolean;
};

type OwnerRow = { owner_id: string; share: string };

type SplitMode = "eur" | "pct";

export function PropertyForm({
  defaults,
  propertyId,
  parentCandidates,
  loansSum,
  availableOwners = [],
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

  // Financing target: acquisition cost total (incl. Nebenkosten) − equity should match Σ loans
  const financingTarget = useMemo(() => {
    if (acquisitionTotal === 0) return null;
    return acquisitionTotal - (equity ?? 0);
  }, [acquisitionTotal, equity]);
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

  const isCreate = !propertyId;
  const [ownerRows, setOwnerRows] = useState<OwnerRow[]>(() =>
    isCreate ? [{ owner_id: "", share: "" }] : []
  );

  const action = propertyId
    ? updateProperty.bind(null, propertyId)
    : createProperty;
  const [state, formAction, pending] = useActionState<
    PropertyFormState,
    FormData
  >(action, undefined);

  // ----- Modell-D-Premium-Dialog ------------------------------------
  // Bei Create kann die Server-Action `premium_choice_needed:N` oder
  // `quantity_upgrade_needed:current:needed` returnen. Wir parsen den
  // Error-Code, zeigen den passenden Dialog und re-submitten mit
  // acknowledge_no_premium=true (Free-Continue), oder leiten zur
  // /einstellungen/abrechnung-Page weiter (Premium-Abo).
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [premiumDialog, setPremiumDialog] = useState<
    | { kind: "choice"; targetCount: number }
    | { kind: "upgrade"; currentQty: number; neededQty: number }
    | null
  >(null);

  useEffect(() => {
    const err = state?.error;
    if (!err) return;
    if (err.startsWith("premium_choice_needed:")) {
      const n = Number(err.split(":")[1] ?? 0);
      setPremiumDialog({ kind: "choice", targetCount: n });
    } else if (err.startsWith("quantity_upgrade_needed:")) {
      const [, c, n] = err.split(":");
      setPremiumDialog({
        kind: "upgrade",
        currentQty: Number(c ?? 0),
        neededQty: Number(n ?? 0),
      });
    }
  }, [state?.error]);

  async function onConfirmUpgrade(neededQty: number) {
    const res = await fetch("/api/billing/quantity-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: neededQty }),
    });
    if (!res.ok) return;
    // Nach erfolgreichem Upgrade Form erneut absenden — der zweite
    // Server-Call sieht subscribed_quantity ≥ propertyCount und lässt durch.
    setPremiumDialog(null);
    formRef.current?.requestSubmit();
  }

  function onChooseFreeContinue() {
    // Setze Hidden-Input + re-submit. Server lässt dann durch ohne Premium.
    const input = formRef.current?.querySelector<HTMLInputElement>(
      "input[name='acknowledge_no_premium']"
    );
    if (input) input.value = "true";
    setPremiumDialog(null);
    formRef.current?.requestSubmit();
  }

  function onChoosePremium(targetCount: number) {
    // Pre-fill Quantity in der Billing-Page und springe direkt zum
    // Checkout-Wizard.
    router.push(
      `/einstellungen/abrechnung?focus_subscribe=true&quantity=${targetCount}`
    );
  }

  const parseShareLocal = (s: string): number => {
    if (!s) return 0;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const validOwnerRows = ownerRows.filter(
    (r) => r.owner_id && parseShareLocal(r.share) > 0
  );
  const ownerShareSum = ownerRows.reduce(
    (acc, r) => acc + parseShareLocal(r.share),
    0
  );
  const ownersSumOk = Math.abs(ownerShareSum - 1) < 0.0001;
  const ownerIdsSelected = ownerRows.map((r) => r.owner_id).filter(Boolean);
  const ownerHasDuplicates =
    new Set(ownerIdsSelected).size !== ownerIdsSelected.length;
  const ownersHaveAnyInput = ownerRows.some(
    (r) => r.owner_id || r.share
  );
  const ownersPayload = JSON.stringify({
    shares: validOwnerRows.map((r) => ({
      owner_id: r.owner_id,
      ownership_share: parseShareLocal(r.share),
    })),
  });

  const canHaveParent = kind !== "house";

  // Hidden values for submit: land_value and building_value_share_pct
  // are always derived to keep the server schema unchanged.
  const submitBuildingPct = splitMode === "eur" ? buildingPctDerived : buildingPct;
  const submitLandValue = splitMode === "eur" ? landValue : landEur;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-8 max-w-3xl"
    >
      {/* Hidden-Flag, wird vom Premium-Dialog auf "true" gesetzt, wenn
          der User "ohne Premium fortfahren" wählt. Bei jedem normalen
          Submit ist es "" → Server-Action zeigt Premium-Dialog. */}
      <input type="hidden" name="acknowledge_no_premium" defaultValue="" />
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
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {t("properties.depreciation_rate_help")}
              </p>
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

        {isCreate && (
          <Section title={t("properties.section_owners")}>
            <input type="hidden" name="owners_payload" value={ownersPayload} />
            {availableOwners.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t("properties.owners_no_owners")}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("properties.owners_share_help")}
                </p>
                <div className="space-y-2">
                  {ownerRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <select
                        value={row.owner_id}
                        onChange={(e) =>
                          setOwnerRows((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, owner_id: e.target.value }
                                : r
                            )
                          )
                        }
                        className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                      >
                        <option value="">
                          {t("properties.owners_select_owner")}
                        </option>
                        {availableOwners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.share}
                        onChange={(e) =>
                          setOwnerRows((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, share: e.target.value }
                                : r
                            )
                          )
                        }
                        placeholder="0,60"
                        className="w-28 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                      />
                      {ownerRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setOwnerRows((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-sm text-neutral-500 hover:text-red-600 px-2 py-2"
                          aria-label="remove"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOwnerRows((prev) => [
                      ...prev,
                      { owner_id: "", share: "" },
                    ])
                  }
                  className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
                >
                  {t("properties.owners_add_row")}
                </button>
                {ownersHaveAnyInput && (
                  <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-2 text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {t("properties.owners_share_sum")}:{" "}
                      <strong
                        className={
                          ownersSumOk
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {ownerShareSum.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </strong>
                    </span>
                  </div>
                )}
                {ownerHasDuplicates && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {t("properties.owners_duplicate")}
                  </p>
                )}
                {ownersHaveAnyInput && !ownersSumOk && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {t("properties.owners_share_invalid", {
                      sum: ownerShareSum.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      }),
                    })}
                  </p>
                )}
              </div>
            )}
          </Section>
        )}

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

        {/* Premium-spezifische Errors werden im Dialog gerendert, nicht
            als FormError-Text — alles andere zeigen wir wie gewohnt. */}
        {state?.error &&
          !state.error.startsWith("premium_choice_needed:") &&
          !state.error.startsWith("quantity_upgrade_needed:") && (
            <FormError raw={state.error} />
          )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              pending ||
              (isCreate &&
                ownersHaveAnyInput &&
                (!ownersSumOk || ownerHasDuplicates))
            }
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending
              ? t("common.loading")
              : propertyId
                ? t("common.save")
                : t("common.create")}
          </button>
        </div>
      </fieldset>

      {premiumDialog?.kind === "choice" && (
        <PremiumChoiceDialog
          targetCount={premiumDialog.targetCount}
          onChoosePremium={() => onChoosePremium(premiumDialog.targetCount)}
          onChooseFreeContinue={onChooseFreeContinue}
          onClose={() => setPremiumDialog(null)}
        />
      )}
      {premiumDialog?.kind === "upgrade" && (
        <QuantityUpgradeDialog
          currentQty={premiumDialog.currentQty}
          neededQty={premiumDialog.neededQty}
          onConfirm={() => onConfirmUpgrade(premiumDialog.neededQty)}
          onClose={() => setPremiumDialog(null)}
        />
      )}
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

/**
 * Dialog beim Anlegen des 2. (bzw. eines weiteren) Objekts ohne aktives
 * Abo. User entscheidet: Premium abschließen ODER ohne Premium-Features
 * weiterarbeiten.
 */
function PremiumChoiceDialog({
  targetCount,
  onChoosePremium,
  onChooseFreeContinue,
  onClose,
}: {
  targetCount: number;
  onChoosePremium: () => void;
  onChooseFreeContinue: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <ModalShell onClose={onClose}>
      <h3 className="text-lg font-semibold">
        {t("billing.choice_dialog_title")}
      </h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t("billing.choice_dialog_intro", { count: targetCount })}
      </p>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onChoosePremium}
          className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-4 py-3 text-left hover:bg-[var(--color-accent)]/10"
        >
          <span className="block font-semibold">
            {t("billing.choice_premium_title")}
          </span>
          <span className="block mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {t("billing.choice_premium_help")}
          </span>
        </button>
        <button
          type="button"
          onClick={onChooseFreeContinue}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <span className="block font-semibold">
            {t("billing.choice_free_title")}
          </span>
          <span className="block mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {t("billing.choice_free_help")}
          </span>
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * Dialog, wenn das geplante Objekt die gebuchte Quantity überschreitet —
 * z. B. 6. Objekt bei Subscription mit Quantity 5. Stripe rechnet die
 * Proration selbst aus; wir bestätigen nur, dass der User OK gibt.
 */
function QuantityUpgradeDialog({
  currentQty,
  neededQty,
  onConfirm,
  onClose,
}: {
  currentQty: number;
  neededQty: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [confirming, setConfirming] = useState(false);
  return (
    <ModalShell onClose={onClose}>
      <h3 className="text-lg font-semibold">
        {t("billing.upgrade_dialog_title")}
      </h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t("billing.upgrade_dialog_intro", {
          current: currentQty,
          needed: neededQty,
        })}
      </p>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {t("billing.upgrade_dialog_proration_note")}
      </p>
      <div className="mt-5 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          disabled={confirming}
          onClick={() => {
            setConfirming(true);
            onConfirm();
          }}
          className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {confirming
            ? t("common.loading")
            : t("billing.upgrade_dialog_confirm")}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 max-w-xl w-full shadow-xl"
      >
        {children}
      </div>
    </div>
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
