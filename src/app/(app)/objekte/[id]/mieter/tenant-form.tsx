"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { upsertTenant, type TenantFormState } from "./actions";
import { tenantScore } from "@/lib/calculations/tenant";
import { TenantScoreBadge } from "@/components/tenant-score-badge";

const FACTORS = [
  "family_status",
  "schufa",
  "rental_duration",
  "personal_impression",
  "employment_status",
  "income_level",
] as const;

export type TenantDefaults = {
  name: string;
  contract_start: string;
  family_status: string;
  schufa: string;
  rental_duration: string;
  personal_impression: string;
  employment_status: string;
  income_level: string;
  notes: string;
};

export const EMPTY_TENANT_DEFAULTS: TenantDefaults = {
  name: "",
  contract_start: "",
  family_status: "",
  schufa: "",
  rental_duration: "",
  personal_impression: "",
  employment_status: "",
  income_level: "",
  notes: "",
};

export function TenantForm({
  propertyId,
  defaults,
  readOnly,
}: {
  propertyId: string;
  defaults: TenantDefaults;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [scores, setScores] = useState<Record<string, string>>({
    family_status: defaults.family_status,
    schufa: defaults.schufa,
    rental_duration: defaults.rental_duration,
    personal_impression: defaults.personal_impression,
    employment_status: defaults.employment_status,
    income_level: defaults.income_level,
  });

  const [state, formAction, pending] = useActionState<
    TenantFormState,
    FormData
  >(upsertTenant.bind(null, propertyId), undefined);

  const currentScore = useMemo(() => {
    const obj: Record<string, number | null> = {};
    for (const f of FACTORS) {
      const v = scores[f];
      obj[f] = v ? Number(v) : null;
    }
    return tenantScore(obj);
  }, [scores]);

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      <fieldset disabled={readOnly} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="name" label={t("tenants.name")} required>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={defaults.name}
              required
              className={inputClass}
            />
          </Field>
          <Field id="contract_start" label={t("tenants.contract_start")}>
            <input
              id="contract_start"
              name="contract_start"
              type="date"
              defaultValue={defaults.contract_start}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t("tenants.score")}
            </h2>
            <TenantScoreBadge score={currentScore} size="lg" />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            {t("tenants.factor_help")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FACTORS.map((f) => (
              <ScoreField
                key={f}
                id={f}
                label={t(`tenants.factor_${f}`)}
                value={scores[f]}
                onChange={(v) => setScores((prev) => ({ ...prev, [f]: v }))}
              />
            ))}
          </div>
        </div>

        <Field id="notes" label={t("tenants.notes")}>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaults.notes}
            className={inputClass}
          />
        </Field>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
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
    </div>
  );
}

function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-sm flex-1">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm w-20"
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
