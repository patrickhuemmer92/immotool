-- =====================================================================
-- 0027_due_diligence
-- KI-gestützte Objekt-Due-Diligence für Käufer VOR dem Kauf.
--
-- Model:
--   due_diligence_projects — 1 Projekt = 1 zu prüfendes Objekt
--   dd_documents          — n Dokumente (Exposé + WEG + Wirtschaftsplan …)
--   dd_findings           — n Risiko-/Positiv-Findings mit Quellenzitat
--   dd_market_data        — n Marktdatenpunkte (Bodenrichtwert etc.)
--   ai_usage              — Token- und Kostentracking pro LLM-Call
--
-- Warum getrennt von `properties`?
-- `properties` sind Objekte, die dem Workspace bereits gehören. Ein DD-
-- Projekt bezieht sich auf ein Objekt, das der Käufer NOCH NICHT besitzt
-- (Watchlist-Stadium). Bei Kauf kann ein DD-Projekt in eine Property
-- promoviert werden — Foreign Key `promoted_to_property_id` merkt sich das.
-- =====================================================================

-- ---------------------------------------------------------------------
-- due_diligence_projects
-- ---------------------------------------------------------------------
create table public.due_diligence_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  -- Anzeige-Attribute
  name text not null,
  address_hint text,

  -- Status:
  --   draft      — angelegt, noch nicht analysiert
  --   analyzed   — Analyse fertig
  --   watchlist  — Nutzer hat "Merkzettel" gewählt (Kaufinteresse)
  --   promoted   — in eine reale Property überführt (nach Kauf)
  --   archived   — abgelegt / kein Interesse mehr
  status text not null default 'draft'
    check (status in ('draft','analyzed','watchlist','promoted','archived')),

  -- Nach Promote: FK auf die entstandene Property
  promoted_to_property_id uuid references public.properties(id) on delete set null,

  -- Kostenmodell: One-off 29 € pro Analyse (siehe Stripe-Integration).
  -- Vor Analyse muss dieser Flag gesetzt sein (via Stripe-Webhook).
  paid boolean not null default false,
  paid_at timestamptz,
  stripe_payment_intent_id text,

  -- Konsolidierte Ergebnisse (JSONB, damit Schema iterativ erweitert
  -- werden kann ohne DB-Migrations pro kleiner Änderung):
  extracted_expose jsonb,          -- 6.1 Exposé-Extraktion
  market_snapshot jsonb,           -- 6.2 Marktdaten
  score_overall integer,           -- 0..100
  score_confidence numeric(3,2),   -- 0..1
  score_by_category jsonb,         -- {substanz: {score,ampel}, ...}

  -- Nachvollziehbarkeit: welches Modell / welcher Prompt-Stand.
  model_version text,
  prompt_version text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  analyzed_at timestamptz
);

create trigger set_dd_projects_updated_at
  before update on public.due_diligence_projects
  for each row execute function public.set_updated_at();

create index dd_projects_workspace_idx
  on public.due_diligence_projects(workspace_id, status, updated_at desc);

alter table public.due_diligence_projects enable row level security;

create policy dd_projects_select on public.due_diligence_projects
  for select using (public.is_workspace_member(workspace_id, 'viewer'));

create policy dd_projects_insert on public.due_diligence_projects
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));

create policy dd_projects_update on public.due_diligence_projects
  for update using (public.is_workspace_member(workspace_id, 'editor'));

create policy dd_projects_delete on public.due_diligence_projects
  for delete using (public.is_workspace_member(workspace_id, 'editor'));

-- ---------------------------------------------------------------------
-- dd_documents
-- Jedes hochgeladene Dokument mit Extraktionsergebnis.
-- storage_path zeigt in den `dd-documents`-Bucket.
-- ---------------------------------------------------------------------
create table public.dd_documents (
  id uuid primary key default gen_random_uuid(),
  dd_project_id uuid not null
    references public.due_diligence_projects(id) on delete cascade,

  kind text not null check (kind in (
    'expose',
    'weg_minutes',           -- Eigentümerversammlungs-Protokoll
    'wirtschaftsplan',       -- Wirtschaftsplan / Hausgeldabrechnung
    'teilungserklaerung',
    'energieausweis',
    'grundriss',
    'other'
  )),

  filename text not null,
  storage_path text not null,   -- <workspace_id>/<dd_project_id>/<uuid>.<ext>
  mime_type text not null,
  size_bytes integer not null,
  file_hash text,               -- sha256 für Cache/Idempotenz

  ocr_status text not null default 'pending'
    check (ocr_status in ('pending','extracted','failed','not_needed')),
  ocr_text_pages integer,       -- Anzahl Seiten mit extrahiertem Text
  ocr_error text,

  -- Extraktions-Ergebnis (typspezifisches JSON, s. src/lib/dd/schemas/*)
  extraction jsonb,
  extracted_at timestamptz,

  uploaded_at timestamptz not null default now()
);

create index dd_documents_project_idx
  on public.dd_documents(dd_project_id, kind);

alter table public.dd_documents enable row level security;

-- Zugriff über den Parent-Project (workspace_id im Parent).
create policy dd_documents_select on public.dd_documents
  for select using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'viewer')
    )
  );

create policy dd_documents_insert on public.dd_documents
  for insert with check (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

create policy dd_documents_update on public.dd_documents
  for update using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

create policy dd_documents_delete on public.dd_documents
  for delete using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

-- ---------------------------------------------------------------------
-- dd_findings
-- Ein Finding = eine belegte Aussage (Red-Flag oder Positiv-Hinweis).
-- ---------------------------------------------------------------------
create table public.dd_findings (
  id uuid primary key default gen_random_uuid(),
  dd_project_id uuid not null
    references public.due_diligence_projects(id) on delete cascade,

  category text not null check (category in (
    'substanz',       -- Bausubstanz, Sanierungsbedarf
    'finanzierung',   -- Finanzierungs-Risiken, Nebenkosten
    'recht',          -- Vertrag, Teilungserklärung, Sondernutzung
    'weg',            -- WEG-spezifische Themen
    'energie',        -- GEG, Energieklasse, Heizungspflicht
    'markt',          -- Preis-Einordnung, Renditerisiko
    'lage'            -- Lärm, Anbindung, Umgebung
  )),
  severity text not null check (severity in ('high','medium','low','positive')),

  title text not null,
  description text not null,       -- laienverständliche Erklärung

  -- Kostenschätzung (optional, mit Zeithorizont):
  cost_min integer,                -- in Cent, für spätere Zins-/Inflations-Rechnung
  cost_max integer,
  cost_horizon text
    check (cost_horizon in ('short','medium','long') or cost_horizon is null),

  -- Beleg: entweder Verweis auf ein Dokument mit Zitat …
  source_document_id uuid references public.dd_documents(id) on delete set null,
  source_quote text,
  source_location text,            -- z.B. "TOP 4, S. 3" oder "§ 5 Abs. 2"
  -- … oder Verweis auf Marktdatenquelle:
  source_market text,              -- z.B. "BORIS-NRW 2024"

  confidence numeric(3,2) not null default 0.5,   -- 0..1
  confidence_reason text,

  next_step text,                  -- was der Nutzer prüfen/fragen sollte

  created_at timestamptz not null default now()
);

create index dd_findings_project_idx
  on public.dd_findings(dd_project_id, severity, category);

alter table public.dd_findings enable row level security;

create policy dd_findings_select on public.dd_findings
  for select using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'viewer')
    )
  );

create policy dd_findings_write on public.dd_findings
  for all using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  ) with check (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

-- ---------------------------------------------------------------------
-- dd_market_data
-- Einzelne Marktdatenkennzahl pro DD-Projekt mit Quelle + Stand.
-- ---------------------------------------------------------------------
create table public.dd_market_data (
  id uuid primary key default gen_random_uuid(),
  dd_project_id uuid not null
    references public.due_diligence_projects(id) on delete cascade,

  metric text not null,            -- z.B. 'bodenrichtwert', 'eur_per_sqm_median'
  value_num numeric,
  value_text text,
  unit text,                       -- 'eur', 'eur_per_sqm', 'ratio', …

  source text not null,            -- 'BORIS-NRW', 'OSM Overpass', …
  source_url text,
  source_date date,                -- Stand der Daten

  created_at timestamptz not null default now()
);

create index dd_market_data_project_idx
  on public.dd_market_data(dd_project_id, metric);

alter table public.dd_market_data enable row level security;

create policy dd_market_data_select on public.dd_market_data
  for select using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'viewer')
    )
  );

create policy dd_market_data_write on public.dd_market_data
  for all using (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  ) with check (
    exists (
      select 1 from public.due_diligence_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

-- ---------------------------------------------------------------------
-- ai_usage
-- Token- und Kostentracking pro LLM-Call. Für Cost-Analyse und
-- späteres Rate-Limiting/Reporting.
-- ---------------------------------------------------------------------
create table public.ai_usage (
  id bigserial primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  dd_project_id uuid references public.due_diligence_projects(id) on delete set null,

  provider text not null,          -- 'anthropic', 'openai', …
  model text not null,             -- 'claude-sonnet-4-5', …
  purpose text not null,           -- 'extract_expose', 'consolidate_findings', …

  tokens_in integer not null,
  tokens_out integer not null,
  cost_cents integer,              -- geschätzte Kosten in EUR-Cent
  duration_ms integer,

  success boolean not null default true,
  error_msg text,

  created_at timestamptz not null default now()
);

create index ai_usage_workspace_idx
  on public.ai_usage(workspace_id, created_at desc);
create index ai_usage_project_idx
  on public.ai_usage(dd_project_id, created_at desc);

alter table public.ai_usage enable row level security;

-- Nur eigene Workspace-Usage lesbar.
create policy ai_usage_select on public.ai_usage
  for select using (public.is_workspace_member(workspace_id, 'viewer'));

-- Schreiben nur via Service-Role (Server-Side LLM-Service) — kein
-- Client-Insert-Policy.

-- ---------------------------------------------------------------------
-- Storage-Bucket: dd-documents
-- Pattern analog zu property-images (Migration 0007), aber mit
-- erweiterter MIME-Whitelist (PDF + Bilder) und größerem Limit.
--
-- Pfad-Konvention: <workspace_id>/<dd_project_id>/<uuid>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dd-documents',
  'dd-documents',
  false,
  20971520,  -- 20 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
    ];

drop policy if exists "dd_documents_select" on storage.objects;
drop policy if exists "dd_documents_insert" on storage.objects;
drop policy if exists "dd_documents_update" on storage.objects;
drop policy if exists "dd_documents_delete" on storage.objects;

create policy "dd_documents_select"
  on storage.objects for select
  using (
    bucket_id = 'dd-documents'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'viewer')
  );

create policy "dd_documents_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'dd-documents'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

create policy "dd_documents_update"
  on storage.objects for update
  using (
    bucket_id = 'dd-documents'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

create policy "dd_documents_delete"
  on storage.objects for delete
  using (
    bucket_id = 'dd-documents'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

select pg_notify('pgrst', 'reload schema');
