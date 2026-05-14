-- =====================================================================
-- 0008_property_finance_and_auto_desc
--   M3 properties.equity_amount       — Eigenkapital (€)
--   M6 properties.description_auto    — true = Bezeichnung wird aus
--                                       street + location_detail automatisch
--                                       zusammengesetzt; false = manueller
--                                       Freitext (gilt als gesetzt sobald der
--                                       User die Bezeichnung selbst überschreibt).
-- funding_cost (Geldbeschaffungskosten) bleibt informativ — Spalte existiert
-- bereits seit 0001 und wird nun wieder vom Property-Form befüllt.
-- =====================================================================

alter table public.properties
  add column if not exists equity_amount numeric(12,2),
  add column if not exists description_auto boolean not null default true;

comment on column public.properties.equity_amount is
  'Eigenkapital (€). Informativer Wert; Anschaffung − Equity sollte der Summe der Darlehen entsprechen.';
comment on column public.properties.description_auto is
  'true = Bezeichnung wird aus Straße + Lage automatisch zusammengesetzt; false = manueller Freitext.';
comment on column public.properties.funding_cost is
  'Geldbeschaffungskosten (€) — informativ, Werbungskosten, kein Bestandteil der Anschaffungskosten.';
