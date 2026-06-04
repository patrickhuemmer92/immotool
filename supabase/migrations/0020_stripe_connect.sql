-- =====================================================================
-- 0020_stripe_connect
-- Stripe Connect: Mapping zwischen Workspace und Connected Account.
--
-- Jeder Workspace kann genau einen Connected Account haben (V2 API).
-- Onboarding-Status holen wir IMMER live von der Stripe-API — wir
-- speichern hier nur die Stripe-Account-ID + Created-At, KEINEN Status,
-- damit wir nicht aus Versehen veraltete Werte aus der DB rendern.
--
-- Plattform-Subscription (Connected-Account abonniert die Plattform):
-- Stripe-Subscription-ID wird hier zusätzlich gespeichert, damit wir
-- per Webhook den Status aktualisieren können (das ist eine separate
-- Subscription, NICHT die Workspace-Tier-Subscription aus 0016_billing).
-- =====================================================================

create table public.connect_accounts (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,

  -- Stripe V2 Connected-Account-ID (Format: acct_...).
  stripe_account_id text not null unique,

  -- Plattform-Subscription, die dieser Connected Account beim
  -- Plattform-Betreiber bucht (z. B. "Premium-Listing").
  -- NULL = noch keine Subscription. Status wird vom Webhook gepflegt.
  platform_subscription_id text unique,
  platform_subscription_status text check (platform_subscription_status in (
    'incomplete','incomplete_expired','trialing','active',
    'past_due','canceled','unpaid','paused'
  )),
  platform_subscription_current_period_end timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connect_accounts_account_idx
  on public.connect_accounts(stripe_account_id);

create trigger connect_accounts_updated_at
  before update on public.connect_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.connect_accounts enable row level security;

-- Workspace-Mitglieder dürfen den eigenen Connect-Status lesen — die
-- Stripe-Account-ID ist kein Secret (sie steht ohnehin in der Storefront-
-- URL), aber wir gewähren keinen Lese-Zugriff für andere Workspaces.
create policy connect_accounts_select_member on public.connect_accounts
  for select using (public.is_workspace_member(workspace_id, 'viewer'));

-- Writes ausschließlich serverseitig (Server-Actions als Workspace-Owner
-- oder Webhook mit service_role / security-definer-RPC).
create or replace function public.upsert_connect_account(
  p_workspace_id uuid,
  p_stripe_account_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.connect_accounts (workspace_id, stripe_account_id)
  values (p_workspace_id, p_stripe_account_id)
  on conflict (workspace_id) do update set
    stripe_account_id = excluded.stripe_account_id;
end;
$$;

-- Plattform-Subscription nachpflegen (vom Snapshot-Webhook genutzt).
create or replace function public.update_connect_platform_subscription(
  p_stripe_account_id text,
  p_subscription_id text,
  p_status text,
  p_current_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.connect_accounts set
    platform_subscription_id = p_subscription_id,
    platform_subscription_status = p_status,
    platform_subscription_current_period_end = p_current_period_end
  where stripe_account_id = p_stripe_account_id;
end;
$$;

-- PostgREST-Schema-Cache invalidieren — die neue Tabelle + RPCs sollen
-- sofort über die Supabase-API verfügbar sein.
select pg_notify('pgrst', 'reload schema');
