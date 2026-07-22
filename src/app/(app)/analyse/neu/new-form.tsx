"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { createDdProject, type DdProjectState } from "../actions";

export function NewDdProjectForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState<DdProjectState, FormData>(
    createDdProject,
    undefined
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          {t("dd.field_name")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder={t("dd.field_name_placeholder")}
          className={inputClass}
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.field_name_hint")}
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="address_hint" className="text-sm font-medium">
          {t("dd.field_address")}
        </label>
        <input
          id="address_hint"
          name="address_hint"
          type="text"
          placeholder={t("dd.field_address_placeholder")}
          className={inputClass}
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("dd.field_address_hint")}
        </p>
      </div>
      <FormError raw={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("dd.create_and_continue")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";
