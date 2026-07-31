-- =====================================================================
-- 0028_ki_onboarding
-- KI-Onboarding: bestehende Objekte per Dokumenten-Upload anlegen.
--
-- Getrennt vom DD-Modul, weil hier der Käufer NICHT vor dem Kauf steht,
-- sondern das Objekt schon besitzt und die Papier-Verträge nur schneller
-- digitalisieren will. Zielobjekt der Extraktion: eine echte
-- properties/loans/tenants-Row.
--
-- Model:
--   onboarding_projects — 1 Projekt = 1 zu digitalisierendes Objekt
--                          (kann mehrere Verträge enthalten)
--   onboarding_documents— hochgeladene Kauf-/Miet-/Darlehensverträge
--                          (bewusst separate Tabelle von dd_documents,
--                           damit die semantische Zuordnung sauber bleibt
--                           und die RLS-Policies je Kontext getrennt sind)
--
-- Ergebnis-Verknüpfung: nach erfolgreicher Extraktion +
-- User-Bestätigung schreiben wir die extrahierten Daten in
-- properties / loans / tenants und speichern die Rück-FK-IDs auf dem
-- Projekt. Das Modell ist damit auch ein Audit-Log: „welches Doku hat
-- welches Feld befüllt?"
-- =====================================================================

create table public.onboarding_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  name text not null,
  status text not null default 'draft' check (
    status in ('draft','extracted','confirmed','archived')
  ),

  -- Nach Confirm: FK zurück auf die entstandenen Rows.
  created_property_id uuid references public.properties(id) on delete set null,
  created_loan_ids uuid[] not null default '{}',
  created_tenant_ids uuid[] not null default '{}',

  -- Kombinierte, editierbare Extraktion (JSONB). Der User kann die
  -- Werte in der Bestätigungsansicht überarbeiten; erst nach Confirm
  -- werden sie in die echten Tabellen geschrieben.
  extracted_summary jsonb,

  -- Paid: entweder via One-Off-Kauf ODER via Premium-Abo. Wir
  -- speichern beides transparent, damit man weiß, wie freigeschaltet
  -- wurde.
  paid boolean not null default false,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  premium_unlock boolean not null default false,

  -- Onboarding-Kontingent: der One-Off-Kauf gilt für „bis zu 20
  -- Objekte / MFH mit 20 Einheiten". Wir zählen die bereits erzeugten
  -- Objekte in derselben paid-Session mit.
  unit_quota_used integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create trigger set_onboarding_projects_updated_at
  before update on public.onboarding_projects
  for each row execute function public.set_updated_at();

create index onboarding_projects_ws_idx
  on public.onboarding_projects(workspace_id, status, updated_at desc);

alter table public.onboarding_projects enable row level security;

create policy onboarding_projects_select on public.onboarding_projects
  for select using (public.is_workspace_member(workspace_id, 'viewer'));

create policy onboarding_projects_insert on public.onboarding_projects
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));

create policy onboarding_projects_update on public.onboarding_projects
  for update using (public.is_workspace_member(workspace_id, 'editor'));

create policy onboarding_projects_delete on public.onboarding_projects
  for delete using (public.is_workspace_member(workspace_id, 'editor'));

-- ---------------------------------------------------------------------
-- onboarding_documents
-- ---------------------------------------------------------------------
create table public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_project_id uuid not null
    references public.onboarding_projects(id) on delete cascade,

  kind text not null check (kind in (
    'kaufvertrag',
    'mietvertrag',
    'darlehensvertrag',
    'grundbuchauszug',
    'other'
  )),

  filename text not null,
  storage_path text not null,   -- <workspace_id>/onboarding/<project_id>/<uuid>.<ext>
  mime_type text not null,
  size_bytes integer not null,
  file_hash text,

  ocr_status text not null default 'pending'
    check (ocr_status in ('pending','extracted','failed','not_needed')),
  ocr_text_pages integer,
  ocr_error text,

  extraction jsonb,
  extracted_at timestamptz,

  uploaded_at timestamptz not null default now()
);

create index onboarding_documents_project_idx
  on public.onboarding_documents(onboarding_project_id, kind);

alter table public.onboarding_documents enable row level security;

create policy onboarding_documents_select on public.onboarding_documents
  for select using (
    exists (
      select 1 from public.onboarding_projects p
      where p.id = onboarding_project_id
        and public.is_workspace_member(p.workspace_id, 'viewer')
    )
  );

create policy onboarding_documents_all on public.onboarding_documents
  for all using (
    exists (
      select 1 from public.onboarding_projects p
      where p.id = onboarding_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  ) with check (
    exists (
      select 1 from public.onboarding_projects p
      where p.id = onboarding_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

-- ---------------------------------------------------------------------
-- Storage-Policies für dd-documents-Bucket erweitern:
-- wir nutzen denselben Bucket unter Pfad-Präfix <workspace_id>/onboarding/...
-- damit die bestehenden Workspace-Policies schon greifen. Deshalb HIER
-- keine neuen Storage-Policies — nur Kommentar zur Doku.
-- ---------------------------------------------------------------------

select pg_notify('pgrst', 'reload schema');
