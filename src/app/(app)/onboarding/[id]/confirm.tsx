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

      // Darlehen-Patch mit den User-Angaben (kind + Bestandsfelder)
      // aus dem lokalen State ins Darlehen-Array mergen.
      const darlehenPatch = initialDarlehen.map((d, i) => {
        const s = loanStates[i];
        if (!s) return d;
        const cb =
          s.current_balance.trim() && Number.isFinite(Number(s.current_balance.replace(",", ".")))
            ? Number(s.current_balance.replace(",", "."))
            : null;
        const cm =
          s.current_monthly_rate.trim() &&
          Number.isFinite(Number(s.current_monthly_rate.replace(",", ".")))
            ? Number(s.current_monthly_rate.replace(",", "."))
            : null;
        const rt =
          s.remaining_term_months.trim() &&
          Number.isFinite(Number(s.remaining_term_months))
            ? Math.round(Number(s.remaining_term_months))
            : null;
        return {
          ...d,
          loan_kind: s.kind,
          current_balance_eur: s.kind === "existing" ? cb : null,
          current_monthly_rate_eur: s.kind === "existing" ? cm : null,
          remaining_term_months: s.kind === "existing" ? rt : null,
        };
      });

      const editPatch: Parameters<typeof saveOnboardingEdit>[1] = {};
      if (Object.keys(patch).length > 0) editPatch.kauf = patch;
      if (darlehenPatch.length > 0)
        editPatch.darlehen = darlehenPatch as Parameters<
          typeof saveOnboardingEdit
        >[1]["darlehen"];

      if (Object.keys(editPatch).length > 0) {
        const save = await saveOnboardingEdit(projectId, editPatch);
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
  const initialDarlehen = initial.darlehen ?? [];

  // Loan-States: pro Darlehen ob "new" oder "existing", plus die
  // Bestands-Zusatzfelder (die editierbar sind, damit User sie
  // ergänzen kann falls die KI sie nicht sicher erkannt hat).
  const [loanStates, setLoanStates] = useState(() =>
    initialDarlehen.map((d) => ({
      kind:
        (d.loan_kind as "new" | "existing" | null) ??
        (d.current_balance_eur ? "existing" : "new"),
      current_balance:
        d.current_balance_eur != null ? String(d.current_balance_eur) : "",
      current_monthly_rate:
        d.current_monthly_rate_eur != null
          ? String(d.current_monthly_rate_eur)
          : "",
      remaining_term_months:
        d.remaining_term_months != null ? String(d.remaining_term_months) : "",
    }))
  );

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

      {/* Darlehen-Preview mit Toggle Neu/Bestand */}
      {initialDarlehen.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            {t("onb.confirm_darlehen", { count: initialDarlehen.length })}
          </h3>
          <div className="space-y-3">
            {initialDarlehen.map((l, i) => {
              const s = loanStates[i];
              if (!s) return null;
              const updateState = (patch: Partial<typeof s>) => {
                setLoanStates((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, ...patch } : x))
                );
              };
              return (
                <div
                  key={i}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {(l.bank as string) ?? "—"}
                        {l.designation ? (
                          <span className="ml-2 text-xs text-neutral-500">
                            {l.designation as string}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                        {l.loan_amount_eur != null
                          ? `${(l.loan_amount_eur as number).toLocaleString("de-DE")} €`
                          : "—"}{" "}
                        @ {(l.interest_rate_pa_pct as number) ?? "?"} % /{" "}
                        {(l.amortization_pa_pct as number) ?? "?"} %{" "}
                        {t("onb.loan_amortization")}
                      </p>
                    </div>
                    {/* Toggle: Neu / Bestand */}
                    <div
                      role="radiogroup"
                      className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 text-xs"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={s.kind === "new"}
                        onClick={() => updateState({ kind: "new" })}
                        className={`px-2.5 py-1 rounded-md ${
                          s.kind === "new"
                            ? "bg-white dark:bg-neutral-900 shadow-sm font-medium"
                            : "text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        {t("onb.loan_kind_new")}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={s.kind === "existing"}
                        onClick={() => updateState({ kind: "existing" })}
                        className={`px-2.5 py-1 rounded-md ${
                          s.kind === "existing"
                            ? "bg-white dark:bg-neutral-900 shadow-sm font-medium"
                            : "text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        {t("onb.loan_kind_existing")}
                      </button>
                    </div>
                  </div>

                  {/* Bestands-Felder — nur bei "existing" */}
                  {s.kind === "existing" && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label={t("onb.loan_current_balance")}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={s.current_balance}
                          onChange={(e) =>
                            updateState({ current_balance: e.target.value })
                          }
                          placeholder="z. B. 285000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label={t("onb.loan_current_rate")}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={s.current_monthly_rate}
                          onChange={(e) =>
                            updateState({
                              current_monthly_rate: e.target.value,
                            })
                          }
                          placeholder="z. B. 1450"
                          className={inputClass}
                        />
                      </Field>
                      <Field label={t("onb.loan_remaining_term")}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={s.remaining_term_months}
                          onChange={(e) =>
                            updateState({
                              remaining_term_months: e.target.value,
                            })
                          }
                          placeholder={t("onb.loan_remaining_term_ph")}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
