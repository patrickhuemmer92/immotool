-- =====================================================================
-- 0014 — Mieter-Nebenkosten (Vorauszahlung Mieter an Vermieter)
-- Kaltmiete + Nebenkosten am Mieter erfasst -> Bruttomiete im Cashflow-
-- Snapshot wird aus dem Mieter-Datensatz vorgeschlagen.
-- =====================================================================

alter table public.tenants
  add column if not exists ancillary_costs_per_month numeric(12,2);

comment on column public.tenants.cold_rent_per_month is
  'Kaltmiete € pro Monat. Zusammen mit ancillary_costs_per_month ergibt sich die Bruttomiete für den Cashflow-Snapshot.';
comment on column public.tenants.ancillary_costs_per_month is
  'Nebenkostenvorauszahlung € pro Monat (Mieter -> Vermieter). Fließt 1:1 in den Cashflow-Snapshot als Ausgleich des Hausgeld-umlagefähig-Anteils.';
