-- =====================================================================
-- immotool — initial schema
-- Multi-tenant via workspaces + workspace_members (RLS).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- WORKSPACES & MEMBERS
-- =====================================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mein Portfolio',
  created_at timestamptz not null default now()
);

create index workspaces_owner_idx on public.workspaces(owner_user_id);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,    -- null while pending
  invited_email text not null,
  role text not null check (role in ('owner','editor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invite_token text unique,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (workspace_id, invited_email)
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index workspace_members_ws_idx on public.workspace_members(workspace_id);
create index workspace_members_token_idx on public.workspace_members(invite_token);

-- ---------------------------------------------------------------------
-- Membership-Helper (zentral für alle RLS-Policies)
-- ---------------------------------------------------------------------
create or replace function public.is_workspace_member(ws_id uuid, min_role text default 'viewer')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = auth.uid()
      and wm.status = 'accepted'
      and case min_role
        when 'viewer' then true
        when 'editor' then wm.role in ('editor','owner')
        when 'owner' then wm.role = 'owner'
        else false
      end
  );
$$;

-- ---------------------------------------------------------------------
-- Auto-Workspace bei Signup
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (owner_user_id, name)
  values (new.id, 'Mein Portfolio')
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, invited_email, role, status, accepted_at)
  values (ws_id, new.id, new.email, 'owner', 'accepted', now());

  insert into public.settings (workspace_id) values (ws_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- SETTINGS (per workspace)
-- =====================================================================
create table public.settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  tax_rate numeric(5,4) not null default 0.35,
  default_depreciation_rate numeric(5,4) not null default 0.02,
  default_locale text not null default 'de' check (default_locale in ('de','en')),
  default_currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- OWNERS (informational; not auth users)
-- =====================================================================
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  tax_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index owners_workspace_idx on public.owners(workspace_id);

-- =====================================================================
-- PROPERTIES
-- =====================================================================
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  street text not null,
  postal_code text not null,
  city text not null,
  location_detail text,         -- Lage, e.g. "2. OG links"
  description text,             -- Bezeichnung, e.g. "2 Z. ETW"
  unit_number text,             -- Wohnungsnummer
  sqm numeric(10,2),
  notary_appointment date,
  transfer_date date,           -- Übergang Nutzen & Lasten
  registration_date date,
  purchase_price numeric(12,2),
  transfer_tax numeric(12,2),
  broker_fee numeric(12,2),
  notary_fee numeric(12,2),
  registration_cost numeric(12,2),
  funding_cost numeric(12,2),   -- Geldbeschaffung
  land_value numeric(12,2),     -- Bodenwert (Sachwert)
  building_value_share_pct numeric(5,4),  -- z.B. 0.85
  depreciation_rate numeric(5,4),         -- pro Objekt überschreibbar
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_workspace_idx on public.properties(workspace_id);

create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create or replace view public.properties_with_full_address as
select
  p.*,
  concat_ws(', ', p.street, p.postal_code || ' ' || p.city, p.location_detail, p.description) as full_address
from public.properties p;

-- =====================================================================
-- PROPERTY ↔ OWNERS (M:N mit Anteil)
-- =====================================================================
create table public.property_owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  ownership_share numeric(5,4) not null check (ownership_share > 0 and ownership_share <= 1),
  created_at timestamptz not null default now(),
  unique (property_id, owner_id)
);

create index property_owners_property_idx on public.property_owners(property_id);
create index property_owners_owner_idx on public.property_owners(owner_id);

-- Trigger: Sum(ownership_share) je property muss 1.0 ergeben
-- DEFERRED: Multiple Inserts in einer Transaktion sind ok
create or replace function public.check_property_owners_sum()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
  total numeric;
begin
  pid := coalesce(new.property_id, old.property_id);
  select sum(ownership_share) into total
  from public.property_owners
  where property_id = pid;

  if total is null then
    return null;  -- alle entfernt → ok
  end if;

  if abs(total - 1.0) > 0.0001 then
    raise exception 'ownership_share sum for property % must equal 1.0, got %', pid, total
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger property_owners_sum_check
  after insert or update or delete on public.property_owners
  deferrable initially deferred
  for each row execute function public.check_property_owners_sum();

-- =====================================================================
-- LOANS
-- =====================================================================
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  designation text not null,
  bank text,
  loan_number text,
  disbursement_date date not null,
  loan_amount numeric(12,2) not null,
  interest_rate_pa numeric(7,6) not null,
  amortization_pa numeric(7,6) not null,
  first_payment_date date not null,
  rate_lock_until date,
  interest_share_first_rate numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);

create index loans_property_idx on public.loans(property_id);

create table public.special_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  payment_date date not null,
  description text,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index special_repayments_loan_idx on public.special_repayments(loan_id);

-- =====================================================================
-- TENANTS (current only)
-- =====================================================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  name text not null,
  contract_start date,
  family_status int check (family_status between 1 and 5),
  schufa int check (schufa between 1 and 5),
  rental_duration int check (rental_duration between 1 and 5),
  personal_impression int check (personal_impression between 1 and 5),
  employment_status int check (employment_status between 1 and 5),
  income_level int check (income_level between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- DEPRECIATION
-- =====================================================================
create table public.other_depreciation_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  item_name text not null,
  acquisition_cost numeric(12,2) not null,
  acquisition_date date not null,
  duration_years int not null,
  notes text,
  created_at timestamptz not null default now()
);

create index other_depreciation_property_idx on public.other_depreciation_items(property_id);

-- =====================================================================
-- P&L SNAPSHOTS
-- =====================================================================
create table public.pnl_snapshots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  cold_rent numeric(12,2),
  ancillary_costs numeric(12,2),
  annuity_override numeric(12,2),
  principal_override numeric(12,2),
  interest_override numeric(12,2),
  property_fee numeric(12,2),
  property_fee_recoverable numeric(12,2),
  property_fee_not_recoverable numeric(12,2),
  maintenance numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (property_id, period_start, period_end)
);

create index pnl_snapshots_property_period_idx on public.pnl_snapshots(property_id, period_start desc);

-- =====================================================================
-- INVESTMENT PLANS
-- =====================================================================
create table public.investment_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  year int,
  is_long_term boolean not null default false,
  amount numeric(12,2) not null,
  description text,
  measure_type text not null check (measure_type in (
    'fixed_individual',
    'optional_individual',
    'fixed_common_reserve',
    'fixed_common_levy',
    'optional_common_reserve',
    'optional_common_levy'
  )),
  created_at timestamptz not null default now(),
  check ((year is not null and is_long_term = false) or (year is null and is_long_term = true))
);

create index investment_plans_property_idx on public.investment_plans(property_id);

-- =====================================================================
-- VALUATIONS
-- =====================================================================
create table public.portfolio_valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  valuation_date date not null,
  condition_score int check (condition_score between 1 and 10),
  market_rent_per_sqm numeric(8,2),
  multiple numeric(6,2),
  building_value numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);

create index portfolio_valuations_property_date_idx on public.portfolio_valuations(property_id, valuation_date desc);

-- =====================================================================
-- IMAGES
-- =====================================================================
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category text not null check (category in ('exterior','living_room','bathroom','kitchen','bedroom','other')),
  storage_path text not null,
  display_order int not null default 0,
  caption text,
  created_at timestamptz not null default now()
);

create index property_images_property_idx on public.property_images(property_id);

-- =====================================================================
-- Convenience helpers (per-property / per-loan ↔ workspace)
-- =====================================================================
create or replace function public.is_property_member(prop_id uuid, min_role text default 'viewer')
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id = prop_id
      and public.is_workspace_member(p.workspace_id, min_role)
  );
$$;

create or replace function public.is_loan_member(l_id uuid, min_role text default 'viewer')
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.loans l
    join public.properties p on p.id = l.property_id
    where l.id = l_id
      and public.is_workspace_member(p.workspace_id, min_role)
  );
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.settings enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.loans enable row level security;
alter table public.special_repayments enable row level security;
alter table public.tenants enable row level security;
alter table public.other_depreciation_items enable row level security;
alter table public.pnl_snapshots enable row level security;
alter table public.investment_plans enable row level security;
alter table public.portfolio_valuations enable row level security;
alter table public.property_images enable row level security;

-- workspaces
create policy ws_select on public.workspaces
  for select using (public.is_workspace_member(id, 'viewer'));
create policy ws_insert on public.workspaces
  for insert with check (owner_user_id = auth.uid());
create policy ws_update on public.workspaces
  for update using (public.is_workspace_member(id, 'owner'));
create policy ws_delete on public.workspaces
  for delete using (owner_user_id = auth.uid());

-- workspace_members
create policy wm_select on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id, 'viewer')
  );
create policy wm_insert on public.workspace_members
  for insert with check (public.is_workspace_member(workspace_id, 'owner'));
create policy wm_update on public.workspace_members
  for update using (
    public.is_workspace_member(workspace_id, 'owner')
    or user_id = auth.uid()      -- pending → accept
  );
create policy wm_delete on public.workspace_members
  for delete using (public.is_workspace_member(workspace_id, 'owner'));

-- settings
create policy settings_select on public.settings
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy settings_update on public.settings
  for update using (public.is_workspace_member(workspace_id, 'owner'));
create policy settings_insert on public.settings
  for insert with check (public.is_workspace_member(workspace_id, 'owner'));

-- owners
create policy owners_select on public.owners
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy owners_insert on public.owners
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));
create policy owners_update on public.owners
  for update using (public.is_workspace_member(workspace_id, 'editor'));
create policy owners_delete on public.owners
  for delete using (public.is_workspace_member(workspace_id, 'owner'));

-- properties
create policy properties_select on public.properties
  for select using (public.is_workspace_member(workspace_id, 'viewer'));
create policy properties_insert on public.properties
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));
create policy properties_update on public.properties
  for update using (public.is_workspace_member(workspace_id, 'editor'));
create policy properties_delete on public.properties
  for delete using (public.is_workspace_member(workspace_id, 'owner'));

-- property_owners
create policy po_select on public.property_owners
  for select using (public.is_property_member(property_id, 'viewer'));
create policy po_insert on public.property_owners
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy po_update on public.property_owners
  for update using (public.is_property_member(property_id, 'editor'));
create policy po_delete on public.property_owners
  for delete using (public.is_property_member(property_id, 'editor'));

-- loans
create policy loans_select on public.loans
  for select using (public.is_property_member(property_id, 'viewer'));
create policy loans_insert on public.loans
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy loans_update on public.loans
  for update using (public.is_property_member(property_id, 'editor'));
create policy loans_delete on public.loans
  for delete using (public.is_property_member(property_id, 'owner'));

-- special_repayments
create policy sr_select on public.special_repayments
  for select using (public.is_loan_member(loan_id, 'viewer'));
create policy sr_insert on public.special_repayments
  for insert with check (public.is_loan_member(loan_id, 'editor'));
create policy sr_update on public.special_repayments
  for update using (public.is_loan_member(loan_id, 'editor'));
create policy sr_delete on public.special_repayments
  for delete using (public.is_loan_member(loan_id, 'editor'));

-- tenants
create policy tenants_select on public.tenants
  for select using (public.is_property_member(property_id, 'viewer'));
create policy tenants_insert on public.tenants
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy tenants_update on public.tenants
  for update using (public.is_property_member(property_id, 'editor'));
create policy tenants_delete on public.tenants
  for delete using (public.is_property_member(property_id, 'editor'));

-- other_depreciation_items
create policy odi_select on public.other_depreciation_items
  for select using (public.is_property_member(property_id, 'viewer'));
create policy odi_insert on public.other_depreciation_items
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy odi_update on public.other_depreciation_items
  for update using (public.is_property_member(property_id, 'editor'));
create policy odi_delete on public.other_depreciation_items
  for delete using (public.is_property_member(property_id, 'editor'));

-- pnl_snapshots
create policy pnl_select on public.pnl_snapshots
  for select using (public.is_property_member(property_id, 'viewer'));
create policy pnl_insert on public.pnl_snapshots
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy pnl_update on public.pnl_snapshots
  for update using (public.is_property_member(property_id, 'editor'));
create policy pnl_delete on public.pnl_snapshots
  for delete using (public.is_property_member(property_id, 'editor'));

-- investment_plans
create policy ip_select on public.investment_plans
  for select using (public.is_property_member(property_id, 'viewer'));
create policy ip_insert on public.investment_plans
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy ip_update on public.investment_plans
  for update using (public.is_property_member(property_id, 'editor'));
create policy ip_delete on public.investment_plans
  for delete using (public.is_property_member(property_id, 'editor'));

-- portfolio_valuations
create policy pv_select on public.portfolio_valuations
  for select using (public.is_property_member(property_id, 'viewer'));
create policy pv_insert on public.portfolio_valuations
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy pv_update on public.portfolio_valuations
  for update using (public.is_property_member(property_id, 'editor'));
create policy pv_delete on public.portfolio_valuations
  for delete using (public.is_property_member(property_id, 'editor'));

-- property_images (table)
create policy pi_select on public.property_images
  for select using (public.is_property_member(property_id, 'viewer'));
create policy pi_insert on public.property_images
  for insert with check (public.is_property_member(property_id, 'editor'));
create policy pi_update on public.property_images
  for update using (public.is_property_member(property_id, 'editor'));
create policy pi_delete on public.property_images
  for delete using (public.is_property_member(property_id, 'editor'));

-- =====================================================================
-- STORAGE: bucket "property-images" (private) + RLS
-- Path convention: {workspace_id}/{property_id}/{filename}
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', false)
on conflict (id) do nothing;

drop policy if exists "property_images_select" on storage.objects;
drop policy if exists "property_images_insert" on storage.objects;
drop policy if exists "property_images_update" on storage.objects;
drop policy if exists "property_images_delete" on storage.objects;

create policy "property_images_select"
  on storage.objects for select
  using (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'viewer')
  );

create policy "property_images_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

create policy "property_images_update"
  on storage.objects for update
  using (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

create policy "property_images_delete"
  on storage.objects for delete
  using (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );
