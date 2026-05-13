"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import {
  createOwner,
  updateOwner,
  type OwnerFormState,
} from "./actions";

export type OwnerDefaults = {
  kind: "person" | "group";
  first_name: string;
  last_name: string;
  name: string;
  notes: string;
};

export const EMPTY_OWNER_DEFAULTS: OwnerDefaults = {
  kind: "person",
  first_name: "",
  last_name: "",
  name: "",
  notes: "",
};

export function OwnerForm({
  defaults,
  ownerId,
  readOnly,
}: {
  defaults: OwnerDefaults;
  ownerId?: string;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [kind, setKind] = useState<"person" | "group">(defaults.kind);
  const action = ownerId ? updateOwner.bind(null, ownerId) : createOwner;
  const [state, formAction, pending] = useActionState<OwnerFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      <fieldset disabled={readOnly} className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">
            {t("owners.kind_label")}
          </label>
          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5">
            <KindRadio
              value="person"
              checked={kind === "person"}
              onChange={setKind}
              label={t("owners.kind_person")}
            />
            <KindRadio
              value="group"
              checked={kind === "group"}
              onChange={setKind}
              label={t("owners.kind_group")}
            />
          </div>
          <input type="hidden" name="kind" value={kind} />
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {kind === "group"
              ? t("owners.kind_group_help")
              : t("owners.kind_person_help")}
          </p>
        </div>

        {kind === "person" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field id="first_name" label={t("owners.first_name")}>
              <input
                id="first_name"
                name="first_name"
                type="text"
                defaultValue={defaults.first_name}
                required
                className={inputClass}
              />
            </Field>
            <Field id="last_name" label={t("owners.last_name")}>
              <input
                id="last_name"
                name="last_name"
                type="text"
                defaultValue={defaults.last_name}
                required
                className={inputClass}
              />
            </Field>
          </div>
        ) : (
          <Field id="name" label={t("owners.group_name")}>
            <input
              id="name"
              name="name"
              type="text"
              placeholder={t("owners.group_name_placeholder")}
              defaultValue={defaults.name}
              required
              className={inputClass}
            />
          </Field>
        )}

        <Field id="notes" label={t("owners.notes")}>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={defaults.notes}
            className={inputClass}
          />
        </Field>

        <FormError raw={state?.error} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
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

function KindRadio({
  value,
  checked,
  onChange,
  label,
}: {
  value: "person" | "group";
  checked: boolean;
  onChange: (v: "person" | "group") => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={
        "px-3 py-1.5 text-sm rounded-md transition-colors " +
        (checked
          ? "bg-accent text-accent-foreground font-medium"
          : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
      }
    >
      {label}
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

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
