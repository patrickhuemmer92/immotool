import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import {
  computeSimulationProjection,
  type SimulationParams,
} from "@/lib/calculations/simulation";
import type {
  InvestmentForProjection,
  LoanForPnL,
  PropertyForPnL,
  SnapshotInputRow,
} from "@/lib/pnl-context";
import { SimulationDetailClient } from "./detail-client";

export default async function SimulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: simulation } = await supabase
    .from("simulations")
    .select(
      `id, name, description, rent_growth_pa, cost_growth_pa, interest_change_bps,
       property_id, workspace_id,
       property:properties!simulations_property_id_fkey(*),
       investments:simulation_investments(id, year, amount, description, tax_treatment, expense_82b_years, useful_life_years)`
    )
    .eq("id", id)
    .maybeSingle();

  if (!simulation || simulation.workspace_id !== active.id) notFound();

  // Supabase liefert die Embedded-Property als Array zurück (sogar bei
  // 1:n-Joins), also defensiv auf "single object or first element of array"
  // mappen, bevor wir mit dem Typ arbeiten. Mit select("*") sind alle
  // PropertyForPnL-Felder enthalten — wir geben TS die Garantie via Cast.
  type PropertyRow = PropertyForPnL & {
    id: string;
    street: string;
    postal_code: string;
    city: string;
    location_detail: string | null;
    description: string | null;
  };
  const rawProperty = simulation.property as unknown;
  const property = (Array.isArray(rawProperty)
    ? (rawProperty[0] as PropertyRow | undefined)
    : (rawProperty as PropertyRow | null)) as PropertyRow;
  if (!property) notFound();

  // Lade Baseline-Inputs: Snapshot (letzter), Darlehen, Settings, reale Inv.
  const [
    { data: latestSnapshot },
    { data: loansData },
    { data: settings },
    { data: investmentsData },
  ] = await Promise.all([
    supabase
      .from("pnl_snapshots")
      .select(
        "period_start, period_end, cold_rent, ancillary_costs, property_fee_recoverable, property_fee_not_recoverable, maintenance, management_costs, vacancy_risk_amount, annuity_override, interest_override, principal_override"
      )
      .eq("property_id", simulation.property_id)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("loans")
      .select(
        "loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, rate_lock_until, special_repayments(payment_date, amount)"
      )
      .eq("property_id", simulation.property_id),
    supabase
      .from("settings")
      .select(
        "tax_rate, default_depreciation_rate, cashflow_convention, default_vacancy_residential, default_vacancy_commercial, default_management_per_unit, bank_maintenance_per_sqm"
      )
      .eq("workspace_id", active.id)
      .maybeSingle(),
    supabase
      .from("investment_plans")
      .select(
        "year, is_long_term, amount, tax_treatment, expense_82b_years, useful_life_years"
      )
      .eq("property_id", simulation.property_id),
  ]);

  const editable = canEdit(active.role);

  // Vorbereiten der Inputs (Defaults wenn nichts da)
  const snapshot: SnapshotInputRow | null = latestSnapshot ?? null;
  const loans: LoanForPnL[] = (loansData ?? []) as LoanForPnL[];
  const realInvestments: InvestmentForProjection[] = (investmentsData ?? []) as InvestmentForProjection[];

  type SimInvRow = {
    id: string;
    year: number;
    amount: string | number;
    description: string | null;
    tax_treatment: string;
    expense_82b_years: number | null;
    useful_life_years: number | null;
  };
  const simInvestments = (simulation.investments as SimInvRow[] | null) ?? [];

  // Zusatz-Investments aus der Simulation in das Format der Projektion bringen
  const additionalInvestments: InvestmentForProjection[] = simInvestments.map(
    (i) => ({
      year: i.year,
      is_long_term: false,
      amount: i.amount,
      tax_treatment: i.tax_treatment,
      expense_82b_years: i.expense_82b_years,
      useful_life_years: i.useful_life_years,
    })
  );

  const simParams: SimulationParams = {
    rentGrowthPa: Number(simulation.rent_growth_pa) || 0,
    costGrowthPa: Number(simulation.cost_growth_pa) || 0,
    interestChangeBps: Number(simulation.interest_change_bps) || 0,
    additionalInvestments,
  };

  // Compute nur, wenn alle Pflicht-Inputs da sind
  const rows =
    snapshot && settings
      ? computeSimulationProjection({
          snapshot,
          property,
          loans,
          settings,
          investments: realInvestments,
          simulation: simParams,
        })
      : [];

  return (
    <div>
      <Link
        href="/simulationen"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("simulations.title")}
      </Link>

      <SimulationDetailClient
        simulationId={simulation.id}
        name={simulation.name}
        description={simulation.description}
        propertyId={simulation.property_id}
        propertyAddress={formatPropertyAddress(property)}
        defaults={{
          property_id: simulation.property_id,
          name: simulation.name,
          description: simulation.description ?? "",
          rent_growth_pa:
            Number(simulation.rent_growth_pa) === 0
              ? ""
              : String(Number(simulation.rent_growth_pa) * 100).replace(".", ","),
          cost_growth_pa:
            Number(simulation.cost_growth_pa) === 0
              ? ""
              : String(Number(simulation.cost_growth_pa) * 100).replace(".", ","),
          interest_change_bps:
            simulation.interest_change_bps === 0
              ? ""
              : String(simulation.interest_change_bps),
        }}
        editable={editable}
        rows={rows}
        hasData={Boolean(snapshot && settings)}
        investments={simInvestments.map((i) => ({
          id: i.id,
          year: i.year,
          amount: Number(i.amount),
          description: i.description,
          tax_treatment: i.tax_treatment,
        }))}
      />
    </div>
  );
}
