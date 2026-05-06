"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  createOwner,
  updateOwner,
  type OwnerFormState,
} from "./actions";

export function OwnerForm({
  defaults,
  ownerId,
  readOnly,
}: {
  defaults: { name: string; tax_id: string; notes: string };
  ownerId?: string;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const action = ownerId ? updateOwner.bind(null, ownerId) : createOwner;
  const [state, formAction, pending] = useActionState<OwnerFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      <fieldset disabled={readOnly} className="space-y-4">
        <Field id="name" label={t("owners.name")}>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={defaults.name}
            required
            className={inputClass}
          />
        </Field>

        <Field id="tax_id" label={t("owners.tax_id")}>
          <input
            id="tax_id"
            name="tax_id"
            type="text"
            defaultValue={defaults.tax_id}
            className={inputClass}
          />
        </Field>

        <Field id="notes" label={t("owners.notes")}>
          <textarea
            id="notes"
            name="notes"
            rows={4}
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
            className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending
              ? t("common.loading")
              : ownerId
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

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
