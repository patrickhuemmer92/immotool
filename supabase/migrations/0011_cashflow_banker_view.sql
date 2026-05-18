-- =====================================================================
-- 0011_cashflow_banker_view
-- Banker-style cashflow view in addition to the investor view.
--
-- Workspace settings:
--   cashflow_convention   'net' (default, intuitiv) | 'gross' (Brutto-Brutto)
--   default_vacancy_residential   default Mietausfallwagnis Wohnen (0.02)
--   default_vacancy_commercial    default Mietausfallwagnis Gewerbe (0.04)
--   default_management_per_unit   monatliche SEV-Pauschale je Einheit (€)
--   bank_maintenance_per_sqm      konservative IH-Pauschale Bank-Sicht (€/m²/p.a.)
--
-- Properties: per-object overrides
--   vacancy_risk_pct
--   management_costs_monthly
--   bank_maintenance_pauschale_per_sqm
--
-- pnl_snapshots: per-period inputs
--   management_costs       — SEV-Verwaltung €/Monat
--   vacancy_risk_amount    — €/Monat (snapshot-level override; sonst aus pct × Kaltmiete)
-- =====================================================================

alter table public.settings
  add column if not exists cashflow_convention text not null default 'net'
    check (cashflow_convention in ('net', 'gross')),
  add column if not exists default_vacancy_residential numeric(5,4) not null default 0.02,
  add column if not exists default_vacancy_commercial numeric(5,4) not null default 0.04,
  add column if not exists default_management_per_unit numeric(10,2) not null default 0,
  add column if not exists bank_maintenance_per_sqm numeric(8,2) not null default 8;

comment on column public.settings.cashflow_convention is
  'net = Kaltmiete als Ertrag / nicht-umlagefähiges HG als Aufwand; gross = Kalt+Umlagen als Ertrag / volles HG als Aufwand. Wirtschaftlich identisch.';
comment on column public.settings.default_vacancy_residential is
  'Mietausfallwagnis für Wohnobjekte (BelWertV §16 — typisch 2 %).';
comment on column public.settings.default_vacancy_commercial is
  'Mietausfallwagnis für Gewerbe (BelWertV §16 — typisch 4 %).';
comment on column public.settings.default_management_per_unit is
  'Workspace-Default SEV-Verwaltungskosten je Einheit, monatlich (€).';
comment on column public.settings.bank_maintenance_per_sqm is
  'Konservative Instandhaltungspauschale für Bank-Sicht (€/m²/p.a., typisch 7–12).';

alter table public.properties
  add column if not exists vacancy_risk_pct numeric(5,4),
  add column if not exists management_costs_monthly numeric(10,2),
  add column if not exists bank_maintenance_pauschale_per_sqm numeric(8,2);

comment on column public.properties.vacancy_risk_pct is
  'Override für MAW; leer = Default aus Settings je nach property.kind.';
comment on column public.properties.management_costs_monthly is
  'Override für SEV-Verwaltungskosten €/Monat.';
comment on column public.properties.bank_maintenance_pauschale_per_sqm is
  'Override für konservative IH-Pauschale Bank-Sicht (€/m²/p.a.).';

alter table public.pnl_snapshots
  add column if not exists management_costs numeric(10,2),
  add column if not exists vacancy_risk_amount numeric(10,2);

comment on column public.pnl_snapshots.management_costs is
  'SEV-Verwaltungskosten €/Monat für diesen Snapshot.';
comment on column public.pnl_snapshots.vacancy_risk_amount is
  'Mietausfallwagnis €/Monat (Override). Leer = aus pct × Kaltmiete berechnet.';
