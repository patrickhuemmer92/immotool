"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { signup, type AuthState } from "../auth-actions";

export function SignupForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    undefined
  );
  // Pflicht-Consent für AGB + Datenschutz. Wir prüfen das clientseitig
  // (UI-Disable des Submit-Buttons) UND serverseitig in signup() —
  // doppelt hält besser.
  const [consent, setConsent] = useState(false);

  if (state?.emailSent) {
    return (
      <div className="rounded-lg border border-accent bg-accent-soft p-4 text-sm">
        <p className="font-medium text-accent-foreground">
          {t("auth.verify_sent_title")}
        </p>
        <p className="mt-1 text-neutral-700">
          {t("auth.verify_sent_body")}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirect_to" value={redirectTo} />

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
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t("auth.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className={inputClass}
        />
      </div>

      {/* Pflicht-Einwilligung — DSGVO Art. 7 + nachweisbare Zustimmung
          beim Account-Anlegen. Inline-Links zu Datenschutz/AGB. */}
      <label className="flex items-start gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-0.5 accent-[var(--color-accent)]"
        />
        <span>
          {t.rich("auth.consent_label", {
            terms: (chunks) => (
              <a
                href="/agb"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-neutral-900"
              >
                {chunks}
              </a>
            ),
            privacy: (chunks) => (
              <a
                href="/datenschutz"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-neutral-900"
              >
                {chunks}
              </a>
            ),
          })}
        </span>
      </label>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending || !consent}
        className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? t("auth.signing_up") : t("auth.signup")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";
