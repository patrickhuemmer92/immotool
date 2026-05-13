"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { requestPasswordReset, type AuthState } from "../auth-actions";

export function ResetRequestForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    undefined
  );

  if (state?.emailSent) {
    return (
      <div className="rounded-lg border border-accent bg-accent-soft p-4 text-sm">
        <p className="font-medium text-accent-foreground">
          {t("auth.reset_sent_title")}
        </p>
        <p className="mt-1 text-neutral-700">{t("auth.reset_sent_body")}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-xs text-neutral-500">{t("auth.reset_help")}</p>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t("auth.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("auth.reset_send")}
      </button>
    </form>
  );
}
