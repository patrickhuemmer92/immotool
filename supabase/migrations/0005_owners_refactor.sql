-- =====================================================================
-- immotool — owners refactor (Bundle C1)
-- Owners become an *entity*: either a single person or a group (e.g.
-- spouses). property_owners keeps pointing at the entity, but
-- owner_members now resolves a group into its persons.
-- =====================================================================

alter table public.owners
  add column if not exists kind text not null default 'person'
    check (kind in ('person', 'group')),
  add column if not exists first_name text,
  add column if not exists last_name text;

-- One-off backfill: split existing `name` into first_name/last_name with a
-- naive "last word = last_name" heuristic. Idempotent — only runs when both
-- columns are still NULL.
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

-- ---------------------------------------------------------------------
-- owner_members — joins person entities into group entities (variant b).
-- ---------------------------------------------------------------------
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
