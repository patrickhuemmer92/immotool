"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateWorkspaceName, type FormState } from "../actions";

export function WorkspaceForm({
  defaultName,
  readOnly,
}: {
  defaultName: string;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateWorkspaceName,
    undefined
  );

  return (
    <form action={action} className="space-y-4 max-w-md">
      <fieldset disabled={readOnly}>
        <label htmlFor="name" className="text-sm font-medium block mb-1">
          {t("settings.workspace_name")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={defaultName}
          required
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
        />

        {state?.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            {t("common.saved")}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("common.loading") : t("common.save")}
        </button>
      </fieldset>
    </form>
  );
}
