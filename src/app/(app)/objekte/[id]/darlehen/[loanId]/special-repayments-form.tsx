"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { dateDe } from "@/lib/format";
import {
  addRecurringSpecialRepayments,
  addSpecialRepayment,
  deleteSpecialRepayment,
  type LoanFormState,
} from "../loan-actions";

type Special = {
  id: string;
  payment_date: string;
  amount: string;
  description: string;
};

export function SpecialRepaymentsForm({
  propertyId,
  loanId,
  specials,
  readOnly,
}: {
  propertyId: string;
  loanId: string;
  specials: Special[];
  readOnly: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pendingDelete, startDelete] = useTransition();
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [recurringMode, setRecurringMode] = useState<"fixed" | "percent">(
    "fixed"
  );
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(
    addSpecialRepayment.bind(null, loanId, propertyId),
    undefined
  );
  const [bulkState, bulkAction, bulkPending] = useActionState<
    LoanFormState,
    FormData
  >(addRecurringSpecialRepayments.bind(null, loanId, propertyId), undefined);

  const thisYear = new Date().getUTCFullYear();

  return (
    <div className="space-y-4">
      {specials.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr className="text-left">
                <Th>{t("loans.special_repayment_date")}</Th>
                <Th>{t("loans.special_repayment_amount")}</Th>
                <Th>{t("loans.special_repayment_description")}</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {specials.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <Td>{dateDe(s.payment_date)}</Td>
                  <Td>
                    {Number(s.amount).toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </Td>
                  <Td>{s.description || "—"}</Td>
                  <Td>
                    {!readOnly && (
                      <button
                        type="button"
                        disabled={pendingDelete}
                        onClick={() => {
                          if (!confirm(t("common.confirm_delete"))) return;
                          startDelete(async () => {
                            await deleteSpecialRepayment(s.id, loanId, propertyId);
                            router.refresh();
                          });
                        }}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        ×
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("common.empty")}
        </p>
      )}

      {!readOnly && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
          {/* Mode-Toggle: Einzel vs. Wiederkehrend */}
          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5 mb-4 text-xs">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-md px-3 py-1 ${
                mode === "single"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {t("loans.special_repayment_mode_single")}
            </button>
            <button
              type="button"
              onClick={() => setMode("recurring")}
              className={`rounded-md px-3 py-1 ${
                mode === "recurring"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {t("loans.special_repayment_mode_recurring")}
            </button>
          </div>

          {mode === "single" ? (
            <form
              action={formAction}
              className="flex flex-wrap gap-2 items-end"
            >
              <div>
                <label className="text-xs font-medium block mb-1">
                  {t("loans.special_repayment_date")}
                </label>
                <input
                  name="payment_date"
                  type="date"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  {t("loans.special_repayment_amount")}
                </label>
                <input
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex-1 min-w-[12rem]">
                <label className="text-xs font-medium block mb-1">
                  {t("loans.special_repayment_description")}
                </label>
                <input name="description" type="text" className={inputClass} />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {t("loans.special_repayment_add")}
              </button>
              {state?.error && (
                <p className="w-full text-sm text-red-600 dark:text-red-400">
                  {state.error}
                </p>
              )}
            </form>
          ) : (
            <form action={bulkAction} className="space-y-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("loans.recurring_hint")}
              </p>

              {/* Sub-mode: fixer Betrag vs. % von Original-Schuld */}
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="fixed"
                    checked={recurringMode === "fixed"}
                    onChange={() => setRecurringMode("fixed")}
                    className="accent-[var(--color-accent)]"
                  />
                  <span>{t("loans.recurring_mode_fixed")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="percent"
                    checked={recurringMode === "percent"}
                    onChange={() => setRecurringMode("percent")}
                    className="accent-[var(--color-accent)]"
                  />
                  <span>{t("loans.recurring_mode_percent")}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {recurringMode === "fixed" ? (
                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {t("loans.recurring_amount")}
                    </label>
                    <input
                      name="amount"
                      type="text"
                      inputMode="decimal"
                      required
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {t("loans.recurring_percent")}
                    </label>
                    <input
                      name="percent"
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="5"
                      className={inputClass}
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("loans.recurring_start_year")}
                  </label>
                  <input
                    name="start_year"
                    type="number"
                    defaultValue={thisYear}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("loans.recurring_end_year")}
                  </label>
                  <input
                    name="end_year"
                    type="number"
                    defaultValue={thisYear + 9}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("loans.recurring_month")}
                  </label>
                  <input
                    name="month"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={12}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("loans.recurring_day")}
                  </label>
                  <input
                    name="day"
                    type="number"
                    min={1}
                    max={28}
                    defaultValue={15}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("loans.recurring_cap")}
                  </label>
                  <input
                    name="cap_total"
                    type="text"
                    inputMode="decimal"
                    placeholder={t("loans.recurring_cap_placeholder")}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={bulkPending}
                  className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {bulkPending
                    ? t("common.loading")
                    : t("loans.recurring_add")}
                </button>
                {bulkState?.error && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {bulkState.error}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 align-middle">{children}</td>;
}
