-- =====================================================================
-- 0025 — Checkout-Consent-Log (Widerrufsverzicht nach § 356 Abs. 4/5 BGB)
-- Bei jedem Stripe-Checkout-Start dokumentieren wir die beiden Pflicht-
-- Zustimmungen separat:
--   1) Sofortiger Leistungsbeginn vor Ablauf der 14-tägigen Widerrufsfrist
--   2) Kenntnisnahme vom Verlust des Widerrufsrechts bei vollständiger
--      Vertragserfüllung
-- Beide MÜSSEN separat angekreuzt werden — eine kombinierte Klausel ist
-- nach BGH-Rechtsprechung unwirksam.
-- =====================================================================

create table public.checkout_consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Erklärung 1 — § 356 Abs. 4/5 BGB Widerrufsverzicht
  consent_immediate_start boolean not null,
  consent_acknowledge_loss boolean not null,
  -- Optional: User-bestätigte AGB-Version, falls AGB inhaltlich versioniert
  -- werden (z. B. "1.0", "2024-10-15").
  terms_version text,
  -- Audit-Trail
  ip_address inet,
  user_agent text,
  -- Stripe-Verkettung — wird nach erfolgreichem Checkout via Webhook
  -- aktualisiert; beim Insert vor dem Redirect ist sie noch null.
  stripe_session_id text,
  -- Konkrete Plan-Daten zum Zeitpunkt der Erklärung, damit später
  -- nachvollziehbar ist, WAS der User zugestimmt hat
  quantity integer not null,
  tier_label text,
  yearly_eur numeric(10,2),
  created_at timestamptz not null default now(),
  -- Constraint: beide Erklärungen müssen true sein, sonst hätte der
  -- Checkout gar nicht starten dürfen
  check (consent_immediate_start = true and consent_acknowledge_loss = true)
);

create index checkout_consents_workspace_idx
  on public.checkout_consents(workspace_id, created_at desc);
create index checkout_consents_user_idx
  on public.checkout_consents(user_id, created_at desc);
create index checkout_consents_session_idx
  on public.checkout_consents(stripe_session_id)
  where stripe_session_id is not null;

-- RLS: nur eigene Workspaces lesen, einfügen via Server-Action (Service-
-- Role-Pfad oder owner-Check)
alter table public.checkout_consents enable row level security;

create policy checkout_consents_select on public.checkout_consents
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy checkout_consents_insert on public.checkout_consents
  for insert with check (
    public.is_workspace_member(workspace_id, 'owner')
    and user_id = auth.uid()
  );
-- Updates kommen ausschließlich vom Webhook → Service-Role bypasst RLS.
-- Wir definieren trotzdem eine Update-Policy für den Fall, dass jemand
-- mit anon-Key + RPC arbeitet (Stripe-Webhook-Fallback).
create policy checkout_consents_update_self on public.checkout_consents
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.checkout_consents is
  'Audit-Trail der Widerrufsverzichts-Erklärungen nach § 356 Abs. 4/5 BGB. Pflicht bei B2C-Abos mit sofortigem Leistungsbeginn.';
