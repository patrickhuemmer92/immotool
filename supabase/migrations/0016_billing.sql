-- =====================================================================
-- 0016_billing
-- Stripe-Anbindung: Wir speichern hier nur einen schlanken Spiegel der
-- Stripe-Subscription je Workspace. Source of Truth bleibt Stripe — diese
-- Tabelle dient als Cache, gepflegt vom Webhook-Handler, damit Tier-Checks
-- (z. B. Objekt-Limit) ohne Stripe-API-Roundtrip funktionieren.
--
-- Tier-Mapping (lookup_key) -> Limits sind in src/lib/billing/tiers.ts.
-- "Free" hat keinen Stripe-Eintrag — Default ist tier_lookup_key=NULL =
-- Free-Tier-Verhalten in der App.
-- =====================================================================

create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,

  -- Stripe-IDs
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  -- Aktive Preis-ID + lookup_key (z. B. "imm_pro_year")
  stripe_price_id text,
  tier_lookup_key text,

  -- Subscription-Lifecycle (1:1 aus Stripe übernommen)
  status text check (status in (
    'incomplete','incomplete_expired','trialing','active',
    'past_due','canceled','unpaid','paused'
  )),

  -- Laufzeit
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_customer_idx on public.subscriptions(stripe_customer_id);
create index subscriptions_status_idx on public.subscriptions(status);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.subscriptions enable row level security;

-- Jedes Workspace-Mitglied darf den eigenen Subscription-Status sehen
-- (Tier wird im UI an viele Stellen gemappt — keine sensiblen Daten
-- darin, da Stripe-IDs zwar Tokens, aber nicht Secrets sind).
create policy subscriptions_select_member on public.subscriptions
  for select using (public.is_workspace_member(workspace_id, 'viewer'));

-- Writes ausschließlich serverseitig (Webhook / Server-Actions mit
-- service_role-Key falls nötig). Wir geben keine UPDATE/INSERT/DELETE-
-- Policy frei — der Webhook umgeht RLS sowieso mit service_role.
-- Falls service_role nicht verfügbar ist, wird der Webhook über
-- security-definer-Funktionen schreiben (siehe unten).

-- ---------------------------------------------------------------------
-- Upsert-Helper (security definer) — vom Webhook aufgerufen, ohne
-- service_role auszukommen.
-- ---------------------------------------------------------------------
create or replace function public.upsert_subscription(
  p_workspace_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_tier_lookup_key text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_trial_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    workspace_id, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, tier_lookup_key, status,
    current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, trial_end
  ) values (
    p_workspace_id, p_stripe_customer_id, p_stripe_subscription_id,
    p_stripe_price_id, p_tier_lookup_key, p_status,
    p_current_period_start, p_current_period_end,
    coalesce(p_cancel_at_period_end, false), p_canceled_at, p_trial_end
  )
  on conflict (workspace_id) do update set
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id        = excluded.stripe_price_id,
    tier_lookup_key        = excluded.tier_lookup_key,
    status                 = excluded.status,
    current_period_start   = excluded.current_period_start,
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    canceled_at            = excluded.canceled_at,
    trial_end              = excluded.trial_end;
end;
$$;

-- Lookup: Workspace-ID anhand Stripe-Customer (für Webhook-Events, die
-- nur customer-IDs liefern).
create or replace function public.workspace_id_for_customer(p_customer_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.subscriptions
  where stripe_customer_id = p_customer_id
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Objekt-Counter pro Workspace (für Tier-Check ohne Roundtrip).
-- Wir zählen sowohl houses als auch apartments — eine Wohnung ist ein
-- eigenes Objekt.
-- ---------------------------------------------------------------------
create or replace function public.workspace_property_count(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.properties
  where workspace_id = p_workspace_id;
$$;
