-- =====================================================================
-- 0013 — Mietverträge (multi-tenant timeline per property)
-- Replaces the single-row `tenants` snapshot with a timeline of rental
-- contracts. Each contract has a tenant name, start date, optional fixed-
-- term flag with end date, and a cold rent (€/month).
-- The old `tenants` table is kept for backward compat (read-only) — UI
-- moves entirely to rental_contracts.
-- =====================================================================

create table public.rental_contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_name text not null,
  contract_start date not null,
  is_fixed_term boolean not null default false,
  contract_end date,
  cold_rent_per_month numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_fixed_term = false and contract_end is null)
    or (is_fixed_term = true and contract_end is not null and contract_end >= contract_start)
  )
);

create index rental_contracts_property_start_idx
  on public.rental_contracts(property_id, contract_start desc);

create trigger rental_contracts_updated_at
  before update on public.rental_contracts
  for each row execute function public.set_updated_at();

alter table public.rental_contracts enable row level security;

create policy rental_contracts_select on public.rental_contracts
  for select using (public.is_property_member(property_id, 'viewer'));
create policy rental_contracts_insert on public.rental_contracts
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy rental_contracts_update on public.rental_contracts
  for update using (public.is_property_member(property_id, 'editor'));
create policy rental_contracts_delete on public.rental_contracts
  for delete using (public.is_property_member(property_id, 'editor'));

-- Best-effort migration: seed contracts from existing tenants snapshots.
-- contract_start falls back to property.transfer_date if tenant.contract_start
-- is null. Assumes "laufender Vertrag" (is_fixed_term = false).
insert into public.rental_contracts (property_id, tenant_name, contract_start, is_fixed_term)
select
  t.property_id,
  t.name,
  coalesce(t.contract_start, p.transfer_date, current_date),
  false
from public.tenants t
join public.properties p on p.id = t.property_id
on conflict do nothing;
