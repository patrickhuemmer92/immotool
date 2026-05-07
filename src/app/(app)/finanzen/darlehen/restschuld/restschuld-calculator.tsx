"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { loanBalance } from "@/lib/calculations/loan";

export type LoanForCalc = {
  id: string;
  designation: string;
  bank: string | null;
  property: { id: string; label: string };
  loanAmount: number;
  interestRatePa: number;
  amortizationPa: number;
  firstPaymentDate: string;
  interestShareFirstRate: number | null;
  specialRepayments: { date: string; amount: number }[];
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RestschuldCalculator({
  loans,
  initialDate,
}: {
  loans: LoanForCalc[];
  initialDate: string;
}) {
  const t = useTranslations();
  const [date, setDate] = useState(initialDate || todayISO());

  const rows = useMemo(() => {
    const at = new Date(date);
    if (Number.isNaN(at.getTime())) return [];
    return loans.map((l) => {
      const balance = loanBalance(
        {
          loanAmount: l.loanAmount,
          interestRatePa: l.interestRatePa,
          amortizationPa: l.amortizationPa,
          firstPaymentDate: new Date(l.firstPaymentDate),
          interestShareFirstRate: l.interestShareFirstRate,
        },
        at,
        l.specialRepayments.map((s) => ({
          date: new Date(s.date),
          amount: s.amount,
        }))
      );
      return { ...l, balance };
    });
  }, [date, loans]);

  const total = rows.reduce((acc, r) => acc + r.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("loans.calc_date")}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("loans.no_loans")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr className="text-left">
                <Th>{t("loans.designation")}</Th>
                <Th>{t("properties.title")}</Th>
                <Th>{t("loans.bank")}</Th>
                <Th>{t("loans.loan_amount")}</Th>
                <Th>{t("loans.remaining_balance")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <Td>
                    <Link
                      href={`/objekte/${r.property.id}/darlehen/${r.id}`}
                      className="hover:underline"
                    >
                      {r.designation}
                    </Link>
                  </Td>
                  <Td>{r.property.label}</Td>
                  <Td>{r.bank ?? "—"}</Td>
                  <Td>{eur(r.loanAmount)}</Td>
                  <Td className="font-semibold tabular-nums">
                    {eur(r.balance)}
                  </Td>
                </tr>
              ))}
              <tr className="border-t-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 font-semibold">
                <Td>Σ</Td>
                <Td></Td>
                <Td></Td>
                <Td>{eur(rows.reduce((a, r) => a + r.loanAmount, 0))}</Td>
                <Td className="font-semibold tabular-nums">{eur(total)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function eur(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
