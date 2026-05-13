"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import {
  createProperty,
  updateProperty,
  type PropertyFormState,
} from "./actions";
import { PROPERTY_KINDS, type PropertyDefaults, type PropertyKind } from "@/lib/properties";

type Props = {
  defaults: PropertyDefaults;
  propertyId?: string;
  /** Top-level house entities the user can pick as parent. */
  parentCandidates: { id: string; label: string }[];
  readOnly: boolean;
};

export function PropertyForm({
  defaults,
  propertyId,
  parentCandidates,
  readOnly,
}: Props) {
  const t = useTranslations();
  const [kind, setKind] = useState<PropertyKind>(defaults.kind);
  const action = propertyId
    ? updateProperty.bind(null, propertyId)
    : createProperty;
  const [state, formAction, pending] = useActionState<
    PropertyFormState,
    FormData
  >(action, undefined);

  const canHaveParent = kind !== "house";

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
            // Always submit empty parent for houses so the column gets cleared.
            <input type="hidden" name="parent_property_id" value="" />
          )}
        </Section>

        <Section title={t("properties.section_address")}>
          <Grid>
            <Field id="street" label={t("properties.street")} required>
              <input
                id="street"
                name="street"
                type="text"
                defaultValue={defaults.street}
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
                  defaultValue={defaults.postal_code}
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
                    defaultValue={defaults.city}
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
                defaultValue={defaults.location_detail}
                className={inputClass}
              />
            </Field>
            <Field id="description" label={t("properties.description")}>
              <input
                id="description"
                name="description"
                type="text"
                defaultValue={defaults.description}
                className={inputClass}
              />
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
              <input
                id="purchase_price"
                name="purchase_price"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.purchase_price}
                className={inputClass}
              />
            </Field>
            <Field id="transfer_tax" label={t("properties.transfer_tax")}>
              <input
                id="transfer_tax"
                name="transfer_tax"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.transfer_tax}
                className={inputClass}
              />
            </Field>
            <Field id="broker_fee" label={t("properties.broker_fee")}>
              <input
                id="broker_fee"
                name="broker_fee"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.broker_fee}
                className={inputClass}
              />
            </Field>
            <Field id="notary_fee" label={t("properties.notary_fee")}>
              <input
                id="notary_fee"
                name="notary_fee"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.notary_fee}
                className={inputClass}
              />
            </Field>
            <Field id="registration_cost" label={t("properties.registration_cost")}>
              <input
                id="registration_cost"
                name="registration_cost"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.registration_cost}
                className={inputClass}
              />
            </Field>
          </Grid>
        </Section>

        <Section title={t("properties.section_valuation_inputs")}>
          <Grid>
            <Field id="land_value" label={t("properties.land_value")}>
              <input
                id="land_value"
                name="land_value"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.land_value}
                className={inputClass}
              />
            </Field>
            <Field
              id="building_value_share_pct"
              label={t("properties.building_value_share_pct")}
            >
              <input
                id="building_value_share_pct"
                name="building_value_share_pct"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.building_value_share_pct}
                className={inputClass}
              />
            </Field>
            <Field id="depreciation_rate" label={t("properties.depreciation_rate")}>
              <input
                id="depreciation_rate"
                name="depreciation_rate"
                type="text"
                inputMode="decimal"
                defaultValue={defaults.depreciation_rate}
                className={inputClass}
              />
            </Field>
          </Grid>
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
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";

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
