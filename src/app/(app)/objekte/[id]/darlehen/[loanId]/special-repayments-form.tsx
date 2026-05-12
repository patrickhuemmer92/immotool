"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
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
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(
    addSpecialRepayment.bind(null, loanId, propertyId),
    undefined
  );

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
                  <Td>{s.payment_date}</Td>
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
        <form
          action={formAction}
          className="flex flex-wrap gap-2 items-end border-t border-neutral-200 dark:border-neutral-800 pt-4"
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
