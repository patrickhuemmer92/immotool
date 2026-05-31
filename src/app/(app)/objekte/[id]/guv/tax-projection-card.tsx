import { getTranslations } from "next-intl/server";
import { eurExact } from "@/lib/format";
import type { TaxProjectionRow } from "@/lib/pnl-context";

export async function TaxProjectionCard({
  rows,
}: {
  rows: TaxProjectionRow[];
}) {
  const t = await getTranslations();
  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">{t("pnl.projection_title")}</h3>
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
          {t("pnl.projection_help")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left">
              <Th>{t("pnl.projection_year")}</Th>
              <Th>{t("pnl.interest")}</Th>
              <Th>{t("pnl.principal")}</Th>
              <Th>{t("pnl.depreciation")}</Th>
              <Th>{t("pnl.projection_invest_deductible")}</Th>
              <Th>{t("pnl.pretax_profit")}</Th>
              <Th>{t("pnl.tax_effect")}</Th>
              <Th>{t("pnl.after_tax_cashflow")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.year}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <Td>
                  <span className="font-medium">Jahr {r.year}</span>
                  <span className="ml-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                    {r.calendarYear}
                  </span>
                </Td>
                <Money value={-r.interest} />
                <Money value={-r.principal} muted />
                <Money value={-r.depreciation} muted />
                <Money
                  value={
                    r.investmentDeductible === 0 ? 0 : -r.investmentDeductible
                  }
                  muted
                />
                <Money value={r.pretaxProfit} />
                <Money value={-r.taxEffect} />
                <Money value={r.afterTaxCashflow} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-2 tabular-nums">{children}</td>;
}

function Money({
  value,
  strong,
  muted,
}: {
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={
        "px-4 py-2 text-right tabular-nums " +
        (strong ? "font-semibold " : "") +
        (muted ? "text-neutral-500 dark:text-neutral-400 " : "") +
        (value < 0 && !muted ? "text-red-600 dark:text-red-400" : "")
      }
    >
      {eurExact(value)}
    </td>
  );
}
