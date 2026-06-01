-- =====================================================================
-- 0019_simulations
-- "Was-wäre-wenn"-Szenarien je Objekt: Mieterhöhung, Kostensteigerung,
-- Zinsänderung bei Zinsbindungsende, zusätzliche Investitionen.
--
-- Jede Simulation gehört zu einem Workspace + Objekt. Die App
-- berechnet 1 Szenario vs. Status Quo — keine Multi-Szenario-Vergleiche
-- in v1, das wäre eigene Erweiterung.
--
-- simulation_investments hängt direkt an einer Simulation und ist
-- bewusst getrennt von investment_plans gehalten: bestehende
-- Investitionen (real, persistent in investment_plans) bleiben dort,
-- Simulations-Investitionen sind "Was-wäre-wenn"-Inputs nur für diese
-- Simulation.
-- =====================================================================

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  description text,

  -- Wachstums-Parameter (alle als Dezimalbrüche, z. B. 0.02 = 2 %)
  rent_growth_pa numeric(6,4) not null default 0,
  cost_growth_pa numeric(6,4) not null default 0,
  -- Zinsänderung in Basispunkten relativ zum aktuellen Zinssatz; greift
  -- ab dem rate_lock_until-Datum des jeweiligen Darlehens. 100 bps =
  -- +1 Prozentpunkt. Negative Werte = Zinsen sinken.
  interest_change_bps integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, name)
);

create index simulations_workspace_idx on public.simulations(workspace_id);
create index simulations_property_idx on public.simulations(property_id);

create trigger simulations_updated_at
  before update on public.simulations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Zusätzliche Investitionen pro Simulation
-- ---------------------------------------------------------------------
create table public.simulation_investments (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,

  -- "Jahr" wie in investment_plans: absolutes Kalenderjahr.
  year integer not null,
  amount numeric(12,2) not null check (amount > 0),
  description text,

  -- Steuerliche Behandlung — gleiches Vokabular wie bei investment_plans.
  tax_treatment text not null default 'expense_immediate'
    check (tax_treatment in (
      'expense_immediate','expense_82b','capitalized_building',
      'capitalized_separate','non_deductible'
    )),
  expense_82b_years integer check (expense_82b_years between 2 and 5),
  useful_life_years integer check (useful_life_years between 1 and 100),

  created_at timestamptz not null default now()
);

create index simulation_investments_simulation_idx
  on public.simulation_investments(simulation_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.simulations enable row level security;
alter table public.simulation_investments enable row level security;

-- simulations: workspace-member-Logik analog zu portfolios.
create policy simulations_select on public.simulations
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy simulations_insert on public.simulations
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));
create policy simulations_update on public.simulations
  for update using (public.is_workspace_member(workspace_id, 'editor'));
create policy simulations_delete on public.simulations
  for delete using (public.is_workspace_member(workspace_id, 'editor'));

-- simulation_investments: über parent-simulation absichern.
create policy si_select on public.simulation_investments
  for select using (
    exists (
      select 1 from public.simulations s
      where s.id = simulation_id
        and public.is_workspace_member(s.workspace_id, 'viewer')
    )
  );
create policy si_insert on public.simulation_investments
  for insert with check (
    exists (
      select 1 from public.simulations s
      where s.id = simulation_id
        and public.is_workspace_member(s.workspace_id, 'editor')
    )
  );
create policy si_update on public.simulation_investments
  for update using (
    exists (
      select 1 from public.simulations s
      where s.id = simulation_id
        and public.is_workspace_member(s.workspace_id, 'editor')
    )
  );
create policy si_delete on public.simulation_investments
  for delete using (
    exists (
      select 1 from public.simulations s
      where s.id = simulation_id
        and public.is_workspace_member(s.workspace_id, 'editor')
    )
  );

-- PostgREST-Cache invalidieren
select pg_notify('pgrst', 'reload schema');
