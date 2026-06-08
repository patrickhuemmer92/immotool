"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { updatePassword, type AuthState } from "../auth-actions";

export function ResetUpdateForm() {
  const t = useTranslations();
  const router = useRouter();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      // Recovery session is now a regular session — drop the user on the
      // dashboard. Small delay so they see the success message.
      const id = setTimeout(() => router.push("/dashboard"), 800);
      return () => clearTimeout(id);
    }
  }, [state?.success, router]);

  if (state?.success) {
    return (
      <div className="rounded-lg border border-accent bg-accent-soft p-4 text-sm">
        <p className="font-medium text-accent-foreground">
          {t("auth.reset_update_done")}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t("auth.password_new")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("auth.reset_update_action")}
      </button>
    </form>
  );
}
