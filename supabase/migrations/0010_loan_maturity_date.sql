-- =====================================================================
-- 0010 — loan maturity date (Endfälligkeit)
-- Optional; distinct from rate_lock_until (Zinsbindungsende).
-- =====================================================================

alter table public.loans
  add column if not exists maturity_date date;
