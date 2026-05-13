-- =====================================================================
-- immotool — bundled migrations 0003–0006
-- Run as a single transaction in the Supabase SQL Editor.
--
-- Contents:
--   0003  property_images.is_cover
--   0004  settings.tenant_score_weights
--   0005  owners refactor (kind / first_name / last_name / owner_members)
--   0006  properties.kind + parent_property_id
--
-- All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE), so
-- re-running this block is safe.
-- =====================================================================

begin;

-- =====================================================================
-- 0003 — property_images.is_cover (Bundle A/G)
-- Explicit cover flag with a partial-unique index so each property has at
-- most one cover image.
-- =====================================================================

alter table public.property_images
  add column if not exists is_cover boolean not null default false;

create unique index if not exists property_images_one_cover_per_property
  on public.property_images(property_id)
  where is_cover = true;


-- =====================================================================
-- 0004 — settings.tenant_score_weights (Bundle D)
-- Per-workspace weights for the 6 tenant-score factors. All-equal weights
-- reproduce the previous simple-average behavior.
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


-- =====================================================================
-- 0005 — owners refactor (Bundle C1)
-- Owners become an entity: either a single person or a group.
-- =====================================================================

alter table public.owners
  add column if not exists kind text not null default 'person'
    check (kind in ('person', 'group')),
  add column if not exists first_name text,
  add column if not exists last_name text;

-- One-off backfill: split existing `name` with a "last word = last_name"
-- heuristic. Idempotent — only runs when both columns are still NULL.
update public.owners
set
  first_name = trim(both ' ' from regexp_replace(name, '\s+\S+$', '')),
  last_name = trim(both ' ' from regexp_replace(name, '^.*\s+', ''))
where first_name is null and last_name is null and name is not null;

-- Keep `name` as the denormalized display column. For persons it is auto-
-- synced from first/last; for groups callers set it directly.
create or replace function public.owners_sync_name()
returns trigger language plpgsql as $$
begin
  if new.kind = 'person' then
    new.name := nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '');
    if new.name is null then
      new.name := 'Unbenannt';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists owners_sync_name_trigger on public.owners;
create trigger owners_sync_name_trigger
  before insert or update of kind, first_name, last_name, name
  on public.owners
  for each row execute function public.owners_sync_name();

-- Steuer-ID was deemed irrelevant; drop the column.
alter table public.owners drop column if exists tax_id;

-- owner_members — joins person entities into group entities (variant b).
create table if not exists public.owner_members (
  id uuid primary key default gen_random_uuid(),
  group_owner_id uuid not null references public.owners(id) on delete cascade,
  person_owner_id uuid not null references public.owners(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (group_owner_id, person_owner_id),
  check (group_owner_id <> person_owner_id)
);

create index if not exists owner_members_group_idx
  on public.owner_members(group_owner_id);
create index if not exists owner_members_person_idx
  on public.owner_members(person_owner_id);

-- Guard: group_owner must be kind='group', person_owner must be kind='person'.
create or replace function public.check_owner_members_kinds()
returns trigger language plpgsql as $$
declare
  g_kind text;
  p_kind text;
begin
  select kind into g_kind from public.owners where id = new.group_owner_id;
  select kind into p_kind from public.owners where id = new.person_owner_id;
  if g_kind <> 'group' then
    raise exception 'group_owner_id % is not of kind group (was: %)', new.group_owner_id, g_kind;
  end if;
  if p_kind <> 'person' then
    raise exception 'person_owner_id % is not of kind person (was: %)', new.person_owner_id, p_kind;
  end if;
  return new;
end;
$$;

drop trigger if exists owner_members_kinds_check on public.owner_members;
create trigger owner_members_kinds_check
  before insert or update on public.owner_members
  for each row execute function public.check_owner_members_kinds();

-- RLS
alter table public.owner_members enable row level security;

create or replace function public.is_owner_workspace_member(o_id uuid, min_role text default 'viewer')
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.owners o
    where o.id = o_id
      and public.is_workspace_member(o.workspace_id, min_role)
  );
$$;

drop policy if exists om_select on public.owner_members;
drop policy if exists om_insert on public.owner_members;
drop policy if exists om_update on public.owner_members;
drop policy if exists om_delete on public.owner_members;

create policy om_select on public.owner_members
  for select using (public.is_owner_workspace_member(group_owner_id, 'viewer'));
create policy om_insert on public.owner_members
  for insert with check (
    public.is_owner_workspace_member(group_owner_id, 'editor')
    and public.is_owner_workspace_member(person_owner_id, 'editor')
  );
create policy om_update on public.owner_members
  for update using (public.is_owner_workspace_member(group_owner_id, 'editor'));
create policy om_delete on public.owner_members
  for delete using (public.is_owner_workspace_member(group_owner_id, 'editor'));


-- =====================================================================
-- 0006 — properties.kind + parent_property_id (Bundle C2)
-- =====================================================================

alter table public.properties
  add column if not exists kind text not null default 'apartment'
    check (kind in ('apartment', 'house', 'parking', 'commercial', 'other'));

alter table public.properties
  add column if not exists parent_property_id uuid
    references public.properties(id) on delete set null;

create index if not exists properties_parent_idx
  on public.properties(parent_property_id);
create index if not exists properties_kind_idx
  on public.properties(kind);


commit;
