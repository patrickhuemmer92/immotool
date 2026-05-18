-- =====================================================================
-- 0012_depreciation_methods
-- AfA-Methodik tief: linear (§ 7 IV), degressiv (§ 7 V) und Sonder-AfA
-- (§ 7b) für Wohngebäude.
--
-- properties:
--   depreciation_method        'linear' | 'degressive_7v' | 'sonder_7b'
--   depreciation_start_year    int       — Jahr 1 der AfA (default = Jahr
--                                           aus transfer_date)
--   sonder_7b_basis_limit      numeric   — optionaler Override der nach
--                                           § 7b geförderten Bemessungs-
--                                           grundlage (max. EUR-Wert);
--                                           leer = Bemessungsgrundlage =
--                                           reguläre AfA-Basis.
--
-- settings:
--   degressive_7v_rate         numeric default 0.05   — §7V-Satz
--   sonder_7b_rate             numeric default 0.05   — §7b-Aufsatzsatz
--   sonder_7b_years            int     default 4      — Dauer Sonder-AfA
--   sonder_7b_linear_rate      numeric default 0.03   — lineare AfA, die
--                                                       neben Sonder-AfA
--                                                       läuft (idR 3 %)
-- =====================================================================

alter table public.properties
  add column if not exists depreciation_method text not null default 'linear'
    check (depreciation_method in ('linear', 'degressive_7v', 'sonder_7b')),
  add column if not exists depreciation_start_year int,
  add column if not exists sonder_7b_basis_limit numeric(12,2);

comment on column public.properties.depreciation_method is
  '''linear'' (§ 7 IV EStG, default), ''degressive_7v'' (§ 7 V EStG, 5 % deg.) oder ''sonder_7b'' (§ 7b EStG, zusätzliche 5 % p.a. in den ersten 4 Jahren neben linearer AfA).';
comment on column public.properties.depreciation_start_year is
  'Jahr 1 der AfA-Reihe. Leer → wird aus transfer_date abgeleitet.';
comment on column public.properties.sonder_7b_basis_limit is
  'Optional begrenzte Bemessungsgrundlage für § 7b (max. EUR der förderfähigen Kosten). Leer = volle AfA-Basis.';

alter table public.settings
  add column if not exists degressive_7v_rate numeric(5,4) not null default 0.05,
  add column if not exists sonder_7b_rate numeric(5,4) not null default 0.05,
  add column if not exists sonder_7b_years int not null default 4,
  add column if not exists sonder_7b_linear_rate numeric(5,4) not null default 0.03;

comment on column public.settings.degressive_7v_rate is
  'Satz für degressive AfA nach § 7 V EStG (typisch 5 %).';
comment on column public.settings.sonder_7b_rate is
  'Aufsatzsatz für Sonder-AfA § 7b EStG (5 % zusätzlich zur linearen).';
comment on column public.settings.sonder_7b_years is
  'Dauer der § 7b-Sonder-AfA in Jahren (typisch 4).';
comment on column public.settings.sonder_7b_linear_rate is
  'Linearer AfA-Satz, der neben Sonder-AfA läuft (typisch 3 %).';
