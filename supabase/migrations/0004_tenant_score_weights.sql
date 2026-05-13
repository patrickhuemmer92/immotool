-- =====================================================================
-- immotool — tenant_score_weights (Bundle D)
-- Per-workspace weights for the 6 tenant-score factors. All-equal weights
-- reproduce the previous simple-average behavior, so existing data keeps
-- the same score.
-- =====================================================================

alter table public.settings
  add column if not exists tenant_score_weights jsonb not null default '{
    "family_status": 1,
    "schufa": 1,
    "rental_duration": 1,
    "personal_impression": 1,
    "employment_status": 1,
    "income_level": 1
  }'::jsonb;
