-- =====================================================================
-- 0015_investment_tax_treatment
-- Steuerliche Behandlung einer Investition (zusätzlich zur bisherigen
-- measure_type-Klassifizierung "wer trägt das wirtschaftlich").
--
-- Fünf Treatments + Sonderfall „durch 15 %-Regel zwangsweise aktiviert":
--
--   expense_immediate         Sofortiger Werbungskostenabzug (Erhaltungs-
--                             aufwand), wirkt im Jahr X komplett.
--
--   expense_82b               Erhaltungsaufwand verteilt nach § 82b EStDV
--                             auf 2–5 Jahre. `expense_82b_years` 2/3/4/5.
--
--   capitalized_building      Aktiviert, läuft mit der Gebäude-AfA-Methode
--                             des Objekts mit (Restnutzungsdauer Gebäude).
--
--   capitalized_separate      Aktiviert mit eigener Nutzungsdauer
--                             (`useful_life_years`, z. B. 10 für neue
--                             Küche / 8 für E-Mobilitäts-Wallbox).
--
--   non_deductible            Privat veranlasst / nicht abzugsfähig —
--                             reiner Cash-Abfluss, keine Steuerwirkung.
--
-- Flag `requalified_15pct` markiert Maßnahmen, die der App-Warner nach
-- § 6 Abs. 1 Nr. 1a EStG zwingend von expense_* auf capitalized_building
-- umqualifiziert hat (3-Jahres-Fenster, > 15 % Gebäudeanschaffung).
-- =====================================================================

alter table public.investment_plans
  add column if not exists tax_treatment text not null
    default 'expense_immediate'
    check (tax_treatment in (
      'expense_immediate',
      'expense_82b',
      'capitalized_building',
      'capitalized_separate',
      'non_deductible'
    )),
  add column if not exists expense_82b_years int
    check (expense_82b_years is null or expense_82b_years between 2 and 5),
  add column if not exists useful_life_years int
    check (useful_life_years is null or useful_life_years between 1 and 100),
  add column if not exists requalified_15pct boolean not null default false;

comment on column public.investment_plans.tax_treatment is
  'Steuerliche Behandlung der Investition: expense_immediate (Erhaltungsaufwand sofort), expense_82b (auf 2-5 Jahre verteilt), capitalized_building (Aktivierung über Gebäude-AfA), capitalized_separate (Aktivierung mit eigener Nutzungsdauer), non_deductible.';
comment on column public.investment_plans.expense_82b_years is
  'Verteilungsjahre für § 82b EStDV (2–5). Nur relevant bei tax_treatment = expense_82b.';
comment on column public.investment_plans.useful_life_years is
  'Eigene Nutzungsdauer in Jahren. Nur relevant bei tax_treatment = capitalized_separate.';
comment on column public.investment_plans.requalified_15pct is
  'true = wurde durch den 15 %-Warner (§ 6 Abs. 1 Nr. 1a EStG) zwingend von expense_* auf capitalized_building umqualifiziert.';
