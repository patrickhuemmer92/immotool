-- =====================================================================
-- 0021_subscription_quantity
-- Modell D: ein einziger Stripe Tiered-Price ersetzt die alten Tier-
-- Produkte. Pro Workspace wird die "gebuchte Quantity" gespeichert
-- (wie viele Objekte hat der User per Abo abgedeckt?), damit wir bei
-- Anlage eines neuen Objekts erkennen können, ob ein Quantity-Upgrade
-- nötig ist.
--
-- Premium-Status leitet sich serverseitig aus drei Quellen ab:
--   - public.properties:  Wie viele Objekte hat der Workspace?
--   - public.subscriptions.status:  active/trialing/past_due?
--   - subscriptions.subscribed_quantity:  Reicht die Quantity?
-- =====================================================================

alter table public.subscriptions
  add column if not exists subscribed_quantity integer;

-- Bestehende Tier-Subscriptions (falls vorhanden) bekommen Default 1 —
-- danach kann der User selbst per Quantity-Upgrade die richtige Stufe
-- buchen, wenn er Modell D nutzen will.
update public.subscriptions
   set subscribed_quantity = 1
 where subscribed_quantity is null;

-- ---------------------------------------------------------------------
-- Upsert-RPC erweitern: Webhook soll subscribed_quantity mit-syncen
-- (kommt aus Stripe.Subscription.items[0].quantity).
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
  p_trial_end timestamptz,
  p_subscribed_quantity integer default null
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
    cancel_at_period_end, canceled_at, trial_end,
    subscribed_quantity
  ) values (
    p_workspace_id, p_stripe_customer_id, p_stripe_subscription_id,
    p_stripe_price_id, p_tier_lookup_key, p_status,
    p_current_period_start, p_current_period_end,
    coalesce(p_cancel_at_period_end, false), p_canceled_at, p_trial_end,
    coalesce(p_subscribed_quantity, 1)
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
    trial_end              = excluded.trial_end,
    subscribed_quantity    = coalesce(excluded.subscribed_quantity, public.subscriptions.subscribed_quantity);
end;
$$;

select pg_notify('pgrst', 'reload schema');
