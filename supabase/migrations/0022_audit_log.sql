-- =====================================================================
-- 0022_audit_log
-- Audit-Trail für sicherheits-/compliance-relevante Tabellen.
--
-- Erfasst INSERT/UPDATE/DELETE pro Row mit:
--   - workspace_id    (für RLS-Scoping)
--   - actor_user_id   (via auth.uid() — null bei Service-Role / Webhook)
--   - table_name + row_id + operation (insert/update/delete)
--   - changed_at      (timestamptz)
--   - row_data        (jsonb mit OLD/NEW, gekürzt auf Schlüsselfelder)
--
-- Bewusst flach gehalten — wir loggen nicht jede Column-Diff, sondern
-- nur den vollen Row-Snapshot zum Zeitpunkt der Änderung. Für DSGVO-
-- Auskunft + Forensik bei Streit reicht das.
--
-- RLS: nur Workspace-Mitglieder mit Owner-Rolle lesen — andere User
-- sollen Audit-Daten nicht sehen.
-- =====================================================================

create table public.audit_log (
  id bigserial primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  row_id text not null,
  operation text not null check (operation in ('insert','update','delete')),
  row_data jsonb,
  changed_at timestamptz not null default now()
);

create index audit_log_workspace_idx
  on public.audit_log(workspace_id, changed_at desc);
create index audit_log_table_row_idx
  on public.audit_log(table_name, row_id);

alter table public.audit_log enable row level security;

create policy audit_log_select_owner on public.audit_log
  for select using (public.is_workspace_member(workspace_id, 'owner'));

-- ---------------------------------------------------------------------
-- Trigger-Funktion — generisch für properties, tenants, subscriptions,
-- portfolios, simulations etc. Holt workspace_id aus dem Row selbst,
-- falls Spalte vorhanden, sonst aus dem parent-property (für tenants).
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  row_id_val text;
  payload jsonb;
begin
  -- workspace_id aus NEW (insert/update) oder OLD (delete) extrahieren.
  if tg_op = 'DELETE' then
    payload = to_jsonb(old);
    row_id_val = (old.id)::text;
    -- properties / tenants / etc. — versuche zuerst direkt, sonst über
    -- property_id Lookup.
    begin
      ws_id = (payload->>'workspace_id')::uuid;
    exception when others then ws_id = null;
    end;
    if ws_id is null and payload ? 'property_id' then
      select p.workspace_id into ws_id
      from public.properties p
      where p.id = (payload->>'property_id')::uuid;
    end if;
  else
    payload = to_jsonb(new);
    row_id_val = (new.id)::text;
    begin
      ws_id = (payload->>'workspace_id')::uuid;
    exception when others then ws_id = null;
    end;
    if ws_id is null and payload ? 'property_id' then
      select p.workspace_id into ws_id
      from public.properties p
      where p.id = (payload->>'property_id')::uuid;
    end if;
  end if;

  insert into public.audit_log (
    workspace_id, actor_user_id, table_name, row_id, operation, row_data
  ) values (
    ws_id,
    auth.uid(),
    tg_table_name,
    row_id_val,
    lower(tg_op),
    payload
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger auf den sicherheits-/compliance-relevanten Tabellen.
-- Sub-Items (pnl_snapshots, loans, investments) absichtlich NICHT —
-- die werden viel zu häufig geschrieben und blasen das Log auf.
-- ---------------------------------------------------------------------
create trigger audit_properties
  after insert or update or delete on public.properties
  for each row execute function public.audit_trigger_fn();

create trigger audit_tenants
  after insert or update or delete on public.tenants
  for each row execute function public.audit_trigger_fn();

create trigger audit_subscriptions
  after insert or update or delete on public.subscriptions
  for each row execute function public.audit_trigger_fn();

create trigger audit_workspaces
  after update or delete on public.workspaces
  for each row execute function public.audit_trigger_fn();

create trigger audit_workspace_members
  after insert or update or delete on public.workspace_members
  for each row execute function public.audit_trigger_fn();

select pg_notify('pgrst', 'reload schema');
