-- =====================================================================
-- 0017_portfolios
-- Frei definierbare Asset-Gruppen ("Portfolios") für Faktbook-Generierung
-- und Filter. Many-to-many: ein Objekt darf gleichzeitig in mehreren
-- Portfolios sein (z. B. „Berlin“ + „Rendite-Top“).
--
-- ACHTUNG: Bitte nicht verwechseln mit der bestehenden Tabelle
-- `portfolio_valuations` — die enthält Bewertungs-Snapshots PRO OBJEKT
-- (per-property valuations). Diese Migration führt eine separate
-- Gruppierungs-Entität ein.
-- =====================================================================

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Doppelte Namen pro Workspace verhindern (Bedienkomfort, keine harte
  -- Anforderung — falls je gewünscht, einfach Constraint droppen).
  unique (workspace_id, name)
);

create index portfolios_workspace_idx on public.portfolios(workspace_id);

create trigger portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Join-Tabelle: welches Objekt ist in welchem Portfolio?
-- Composite-Primary-Key (portfolio_id, property_id) verhindert Duplikate
-- automatisch. Cascade-Delete in beide Richtungen, damit nichts
-- verwaiste Verweise hinterlässt.
-- ---------------------------------------------------------------------
create table public.portfolio_properties (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (portfolio_id, property_id)
);

create index portfolio_properties_property_idx
  on public.portfolio_properties(property_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.portfolios enable row level security;
alter table public.portfolio_properties enable row level security;

-- portfolios: workspace-member-Logik wie bei properties.
create policy portfolios_select on public.portfolios
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy portfolios_insert on public.portfolios
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));
create policy portfolios_update on public.portfolios
  for update using (public.is_workspace_member(workspace_id, 'editor'));
create policy portfolios_delete on public.portfolios
  for delete using (public.is_workspace_member(workspace_id, 'editor'));

-- portfolio_properties: lesen darf jeder Workspace-Member, schreiben
-- nur editor+. Wir prüfen via Portfolio (das wiederum am Workspace
-- hängt) — Property muss ebenfalls im selben Workspace sein, das ist
-- über die zwei FKs garantiert, sobald beide RLS-checks bestanden sind.
create policy pp_select on public.portfolio_properties
  for select using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and public.is_workspace_member(p.workspace_id, 'viewer')
    )
  );
create policy pp_insert on public.portfolio_properties
  for insert with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
    and public.is_property_member(property_id, 'editor')
  );
create policy pp_delete on public.portfolio_properties
  for delete using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

-- PostgREST-Schema-Cache nach DDL invalidieren, damit die neuen
-- Tabellen + RPCs sofort über die Supabase-API sichtbar sind.
select pg_notify('pgrst', 'reload schema');
