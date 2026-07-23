import { getTranslations } from "next-intl/server";
import type { ExposeExtraction } from "@/lib/dd/schemas/expose";
import {
  computeAcquisitionCosts,
  computeGrossYield,
} from "@/lib/dd/acquisition";

/**
 * Server-Component: Kaufnebenkosten- und Rendite-Karte für die DD-
 * Detail-Seite. Rendert nur wenn Kaufpreis bekannt ist — sonst wäre
 * die Berechnung sinnlos.
 */
export async function AcquisitionCard({
  expose,
}: {
  expose: ExposeExtraction;
}) {
  const t = await getTranslations();

  if (!expose.purchase_price_eur || expose.purchase_price_eur <= 0) {
    return null;
  }

  const acq = computeAcquisitionCosts({
    purchase_price_eur: expose.purchase_price_eur,
    postal_code: expose.postal_code ?? null,
    broker_commission_eur: expose.broker_commission_eur ?? null,
    broker_commission_pct: expose.broker_commission_pct ?? null,
  });

  const yieldR = computeGrossYield({
    purchase_price_eur: expose.purchase_price_eur,
    monthly_cold_rent_eur: expose.current_cold_rent_per_month_eur ?? null,
    total_acquisition_eur: acq.total_acquisition_eur,
  });

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
        {t("dd.acq_title")}
      </h3>

      {/* Nebenkosten-Übersicht */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            {t("dd.acq_side_costs")}
          </p>
          <ul className="space-y-1 text-sm">
            <Row
              label={t("dd.acq_price")}
              value={eur(acq.purchase_price_eur)}
              muted
            />
            <Row
              label={`${t("dd.acq_transfer_tax")} (${(acq.transfer_tax_pct * 100).toLocaleString(
                "de-DE",
                { maximumFractionDigits: 2 }
              )} %, ${acq.state_code})`}
              value={eur(acq.transfer_tax_eur)}
            />
            <Row
              label={`${t("dd.acq_notary")} (~${(acq.notary_grundbuch_pct * 100).toLocaleString(
                "de-DE"
              )} %)`}
              value={eur(acq.notary_grundbuch_eur)}
            />
            {acq.broker_fee_eur != null ? (
              <Row
                label={t("dd.acq_broker")}
                value={eur(acq.broker_fee_eur)}
              />
            ) : (
              <Row
                label={t("dd.acq_broker")}
                value={t("dd.acq_broker_unknown")}
                muted
              />
            )}
            <Row
              label={t("dd.acq_side_total")}
              value={eur(acq.side_costs_total_eur)}
              strong
            />
            <Row
              label={t("dd.acq_grand_total")}
              value={eur(acq.total_acquisition_eur)}
              strong
              highlight
            />
          </ul>
          <p className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug">
            {t("dd.acq_disclaimer")}
          </p>
        </div>

        {/* Rendite (nur wenn Miete bekannt) */}
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            {t("dd.acq_yield_title")}
          </p>
          {yieldR.gross_yield_pct == null ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("dd.acq_yield_no_rent")}
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              <Row
                label={t("dd.acq_yield_monthly")}
                value={eur(yieldR.monthly_rent_eur!)}
                muted
              />
              <Row
                label={t("dd.acq_yield_annual")}
                value={eur(yieldR.monthly_rent_eur! * 12)}
                muted
              />
              <Row
                label={t("dd.acq_yield_gross_on_price")}
                value={pct(yieldR.gross_yield_pct)}
                strong
              />
              {yieldR.gross_yield_on_total_pct != null && (
                <Row
                  label={t("dd.acq_yield_gross_on_total")}
                  value={pct(yieldR.gross_yield_on_total_pct)}
                  strong
                  highlight
                />
              )}
              <p className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug">
                {t("dd.acq_yield_note")}
              </p>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  highlight?: boolean;
}) {
  const cls = [
    "flex justify-between gap-4 tabular-nums",
    muted ? "text-neutral-500 dark:text-neutral-400" : "",
    strong ? "font-semibold" : "",
    highlight ? "border-t border-neutral-200 dark:border-neutral-800 pt-1 mt-1" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li className={cls}>
      <span>{label}</span>
      <span>{value}</span>
    </li>
  );
}

function eur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function pct(n: number): string {
  return (n * 100).toLocaleString("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }) + " %";
}
