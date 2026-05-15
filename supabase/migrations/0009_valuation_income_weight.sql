-- =====================================================================
-- 0009 — per-snapshot valuation income/replacement weight
-- Default 0.5 keeps existing combined values unchanged.
-- 0.0 = pure Sachwert, 1.0 = pure Ertragswert.
-- =====================================================================

alter table public.portfolio_valuations
  add column if not exists income_weight numeric(4,3) not null default 0.5
    check (income_weight >= 0 and income_weight <= 1);
