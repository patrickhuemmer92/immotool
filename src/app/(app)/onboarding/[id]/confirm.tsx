"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { confirmOnboarding, saveOnboardingEdit } from "../actions";

/**
 * Kompakte Anzeige der extrahierten Werte + Confirm-Button.
 *
 * v1: read-only-Preview + Save-und-Anlegen-Aktion. Vollständige
 * Editieren-UI der Extraktionsstruktur (verschachtelt, mit Arrays
 * für Miete/Darlehen) wäre ein eigener Wurf; für den MVP zeigen wir
 * die Werte an, User bestätigt und darf danach in der Property-
 * Bearbeiten-Seite justieren.
 */
export function OnboardingConfirm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    kauf?: Record<string, unknown>;
    miete?: Record<string, unknown>[];
    darlehen?: Record<string, unknown>[];
  };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editier-State — v1: nur die Kauf-Kernfelder inline änderbar
  const [street, setStreet] = useState<string>(
    (initial.kauf?.street as string) ?? ""
  );
  const [postal, setPostal] = useState<string>(
    (initial.kauf?.postal_code as string) ?? ""
  );
  const [city, setCity] = useState<string>(
    (initial.kauf?.city as string) ?? ""
  );
  const [priceStr, setPriceStr] = useState<string>(
    initial.kauf?.purchase_price_eur != null
      ? String(initial.kauf.purchase_price_eur)
      : ""
  );

  function onConfirm() {
    setError(null);
    start(async () => {
      // 1) Änderungen an Kauf-Feldern speichern
      const patch: Record<string, unknown> = {};
      if (street.trim()) patch.street = street.trim();
      if (postal.trim()) patch.postal_code = postal.trim();
      if (city.trim()) patch.city = city.trim();
      const price = priceStr.trim() ? Number(priceStr.replace(",", ".")) : null;
      if (price != null && Number.isFinite(price)) patch.purchase_price_eur = price;

      if (Object.keys(patch).length > 0) {
        const save = await saveOnboardingEdit(projectId, { kauf: patch });
        if (save.error) {
          setError(save.error);
          return;
        }
      }

      // 2) Property-Anlage triggern
      const result = await confirmOnboarding(projectId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.propertyId) {
        router.push(`/objekte/${result.propertyId}`);
      } else {
        router.refresh();
      }
    });
  }

  const mieten = initial.miete ?? [];
  const darlehen = initial.darlehen ?? [];

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-6">
      {/* Kauf-Section */}
      {initial.kauf && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            {t("onb.confirm_kauf")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("onb.f_street")}>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("onb.f_postal")}>
              <input
                type="text"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("onb.f_city")}>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("onb.f_price")}>
              <input
                type="text"
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <SummaryChip summary={initial.kauf.short_summary as string} />
        </div>
      )}

      {/* Miete-Preview */}
      {mieten.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            {t("onb.confirm_miete", { count: mieten.length })}
          </h3>
          <ul className="space-y-1 text-sm">
            {mieten.map((m, i) => (
              <li key={i} className="text-neutral-700 dark:text-neutral-300">
                • {(m.tenant_name as string) ?? "—"} —{" "}
                {m.cold_rent_per_month_eur != null
                  ? `${(m.cold_rent_per_month_eur as number).toLocaleString("de-DE")} € kalt`
                  : "—"}
                {m.unit_reference ? ` · ${m.unit_reference as string}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Darlehen-Preview */}
      {darlehen.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            {t("onb.confirm_darlehen", { count: darlehen.length })}
          </h3>
          <ul className="space-y-1 text-sm">
            {darlehen.map((l, i) => (
              <li key={i} className="text-neutral-700 dark:text-neutral-300">
                • {(l.bank as string) ?? "—"}:{" "}
                {l.loan_amount_eur != null
                  ? `${(l.loan_amount_eur as number).toLocaleString("de-DE")} €`
                  : "—"}{" "}
                @ {(l.interest_rate_pa_pct as number) ?? "?"} % /{" "}
                {(l.amortization_pa_pct as number) ?? "?"} % Tilgung
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? t("common.loading") : t("onb.confirm_cta")}
        </button>
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {error === "address_missing"
              ? t("onb.error_address_missing")
              : error === "payment_required"
                ? t("onb.error_payment_required")
                : error}
          </span>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}

function SummaryChip({ summary }: { summary: string | undefined }) {
  if (!summary) return null;
  return (
    <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 italic">
      „{summary}"
    </p>
  );
}
