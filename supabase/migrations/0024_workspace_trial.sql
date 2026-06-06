-- =====================================================================
-- 0024 — 7-Tage-Workspace-Trial
-- Jeder neue Workspace bekommt einen Trial-Endezeitpunkt 7 Tage nach
-- Anlage. Solange dieser Zeitpunkt in der Zukunft liegt, behandelt
-- getPremiumStatus() den Workspace als Premium — alle Features, beliebig
-- viele Objekte. Nach Ablauf greifen die normalen Free-Regeln
-- (1 Objekt frei, ab dem 2. wird Abo benötigt).
-- =====================================================================

alter table public.workspaces
  add column if not exists trial_ends_at timestamptz;

comment on column public.workspaces.trial_ends_at is
  '7-Tage-Setup-Trial ab Workspace-Erstellung. NULL = kein Trial / legacy.';

-- Backfill für existierende Workspaces: 7 Tage ab created_at.
-- Bei länger bestehenden Workspaces liegt der Wert in der Vergangenheit —
-- dann gilt sofort die normale Free-Regel.
update public.workspaces
set trial_ends_at = created_at + interval '7 days'
where trial_ends_at is null;

-- handle_new_user neu definieren: setzt trial_ends_at explizit, legt
-- weiterhin Demo-Objekt + Begleitdaten an (Bestand aus 0023).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  prop_id uuid;
  transfer_dt date := (current_date - interval '1 year')::date;
begin
  insert into public.workspaces (owner_user_id, name, trial_ends_at)
  values (new.id, 'Mein Portfolio', now() + interval '7 days')
  returning id into ws_id;

  insert into public.workspace_members
    (workspace_id, user_id, invited_email, role, status, accepted_at)
  values (ws_id, new.id, new.email, 'owner', 'accepted', now());

  insert into public.settings (workspace_id) values (ws_id);

  insert into public.properties (
    workspace_id, kind, is_demo,
    street, postal_code, city, location_detail, description,
    sqm,
    notary_appointment, transfer_date, registration_date,
    purchase_price, transfer_tax, broker_fee, notary_fee, registration_cost,
    equity_amount,
    land_value, building_value_share_pct, depreciation_rate,
    notes
  ) values (
    ws_id, 'apartment', true,
    'Beispielstraße 12', '80331', 'München', '2. OG links', '2 Z. ETW',
    65,
    transfer_dt - 60, transfer_dt, transfer_dt + 90,
    350000, 12250, 0, 5250, 1750,
    50000,
    70000, 0.80, 0.02,
    'Beispiel-Datensatz — du kannst diese Wohnung jederzeit löschen oder durch dein echtes Objekt ersetzen.'
  )
  returning id into prop_id;

  insert into public.loans (
    property_id, designation, bank,
    disbursement_date, loan_amount,
    interest_rate_pa, amortization_pa,
    first_payment_date, rate_lock_until
  ) values (
    prop_id, 'Beispiel-Annuitätendarlehen', 'Beispielbank',
    transfer_dt, 320000,
    0.035, 0.02,
    transfer_dt + 30, (transfer_dt + interval '10 years')::date
  );

  insert into public.tenants (
    property_id, name, contract_start,
    is_fixed_term, contract_end,
    cold_rent_per_month, ancillary_costs_per_month,
    notes
  ) values (
    prop_id, 'Familie Beispiel', transfer_dt,
    false, null,
    1150, 220,
    'Demo-Mietvertrag'
  );

  insert into public.portfolio_valuations (
    property_id, valuation_date,
    condition_score, market_rent_per_sqm, multiple,
    building_value, income_weight
  ) values (
    prop_id, current_date,
    8, 18, 25,
    300000, 0.60
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
