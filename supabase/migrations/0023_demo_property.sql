-- =====================================================================
-- 0023 — Demo-Immobilie für neue Nutzer
-- Neue User sehen direkt ein gefülltes Beispiel-Objekt (Wohnung in
-- München) — die ganzen Berechnungen (Cashflow, AfA, LTV, Marktwert)
-- haben dann von Anfang an Werte. Die Demo ist über is_demo=true
-- markiert und kann jederzeit gelöscht werden.
-- =====================================================================

-- 1) Flag-Spalte
alter table public.properties
  add column if not exists is_demo boolean not null default false;

create index if not exists properties_is_demo_idx
  on public.properties(is_demo) where is_demo = true;

-- 2) Trigger erweitern: legt zusätzlich eine Beispiel-Wohnung an
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
  insert into public.workspaces (owner_user_id, name)
  values (new.id, 'Mein Portfolio')
  returning id into ws_id;

  insert into public.workspace_members
    (workspace_id, user_id, invited_email, role, status, accepted_at)
  values (ws_id, new.id, new.email, 'owner', 'accepted', now());

  insert into public.settings (workspace_id) values (ws_id);

  -- Beispiel-Wohnung: 2-Zimmer-ETW in München, ~12 Monate gehalten.
  -- Realistische, runde Zahlen — soll auf einen Blick zeigen, was
  -- möglich ist.
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

  -- Beispiel-Darlehen: 320k @ 3,5 % Zins, 2 % Tilgung — Annuität ~1.467 €/M
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

  -- Beispiel-Mieter: Kaltmiete 1.150 €, Nebenkosten 220 €, laufend
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

  -- Beispiel-Bewertung: aktueller Marktwert via Bruttofaktor + Sachwert.
  -- 60/40 zugunsten Ertragswert.
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

-- Trigger neu binden (auf den aktualisierten Function-Body).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
