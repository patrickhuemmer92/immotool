-- =====================================================================
-- 0026 — Kündigungs-Log (§ 312k BGB)
-- Jede über die Kündigungsfunktion auf der Website abgegebene Erklärung
-- wird hier protokolliert. Pflicht zur Aufbewahrung der Bestätigung der
-- Eingangszeit (§ 312k Abs. 3 BGB).
-- =====================================================================

create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ordentlich', 'fristlos')),
  requested_date date,
  reason text,
  -- Audit-Trail (§ 312k Abs. 3: Eingangszeit muss bestätigt werden)
  ip_address inet,
  user_agent text,
  -- Stripe-Subscription, die gecancelt wurde
  stripe_subscription_id text,
  -- Stripe-Status nach dem Cancel-Aufruf (z. B. "canceled" oder
  -- "active" + cancel_at_period_end=true)
  stripe_cancel_result text,
  -- Bestätigungs-Mail-Status (für späteren Abgleich mit dem Mail-System)
  confirmation_email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index cancellations_workspace_idx
  on public.cancellations(workspace_id, created_at desc);
create index cancellations_user_idx
  on public.cancellations(user_id, created_at desc);

alter table public.cancellations enable row level security;

create policy cancellations_select on public.cancellations
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy cancellations_insert on public.cancellations
  for insert with check (
    public.is_workspace_member(workspace_id, 'owner')
    and user_id = auth.uid()
  );

comment on table public.cancellations is
  'Audit-Trail der Kündigungserklärungen nach § 312k BGB. Pflicht-Aufzeichnung der Eingangszeit + Bestätigung in Textform.';
