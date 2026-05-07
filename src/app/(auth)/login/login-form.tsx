"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, type AuthState } from "../auth-actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    undefined
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirect_to" value={redirectTo} />

      <Field id="email" label={t("auth.email")}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </Field>

      <Field id="password" label={t("auth.password")}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          className={inputClass}
        />
      </Field>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("auth.logging_in") : t("auth.login")}
      </button>
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
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
