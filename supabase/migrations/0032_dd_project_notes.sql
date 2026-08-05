-- =====================================================================
-- 0032_dd_project_notes
-- Gesprächsnotizen zu einem DD-Projekt.
--
-- Bisher gab es dafür `dd_projects.extra_user_context` — ein einzelnes
-- Textfeld, das bei jedem Speichern überschrieben wird. Das trägt für
-- einen Vermerk, aber nicht für den realen Ablauf: Besichtigung,
-- Rückruf des Verwalters, Hinweis vom Nachbarn, drei Wochen später eine
-- Korrektur des Maklers. In einem Blob steht am Ende alles gleichwertig
-- nebeneinander, ohne Datum und ohne Quelle — und wer beim Nachtragen
-- kürzt, verliert Früheres ersatzlos.
--
-- Als Liste kann das Modell dagegen sehen, WANN etwas gesagt wurde und
-- VON WEM. Eine spätere Aussage, die eine frühere korrigiert, ist damit
-- als solche erkennbar.
--
-- `extra_user_context` bleibt als Spalte bestehen (nichts wird still
-- gelöscht), wird aber nicht mehr gelesen. Vorhandene Inhalte wandern
-- unten in je eine Notiz.
-- =====================================================================

create table if not exists public.dd_project_notes (
  id uuid primary key default gen_random_uuid(),
  dd_project_id uuid not null
    references public.dd_projects(id) on delete cascade,

  -- Wann das Gespräch/die Beobachtung war — nicht wann getippt wurde.
  -- Nachträge zu einem älteren Termin sind der Normalfall.
  occurred_on date not null default current_date,

  source text not null default 'sonstiges' check (source in (
    'makler',
    'verwalter',
    'verkaeufer',
    'eigene_beobachtung',
    'handwerker',
    'bank',
    'sonstiges'
  )),

  note text not null check (length(btrim(note)) > 0 and length(note) <= 2000),

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Leseabfrage ist immer „alle Notizen eines Projekts, chronologisch".
create index if not exists dd_project_notes_project_idx
  on public.dd_project_notes(dd_project_id, occurred_on desc, created_at desc);

alter table public.dd_project_notes enable row level security;

-- Zugriff über den Parent-Project (workspace_id liegt dort).
create policy dd_project_notes_select on public.dd_project_notes
  for select using (
    exists (
      select 1 from public.dd_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'viewer')
    )
  );

create policy dd_project_notes_insert on public.dd_project_notes
  for insert with check (
    exists (
      select 1 from public.dd_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

create policy dd_project_notes_update on public.dd_project_notes
  for update using (
    exists (
      select 1 from public.dd_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

create policy dd_project_notes_delete on public.dd_project_notes
  for delete using (
    exists (
      select 1 from public.dd_projects p
      where p.id = dd_project_id
        and public.is_workspace_member(p.workspace_id, 'editor')
    )
  );

-- ---------------------------------------------------------------------
-- Bestand übernehmen: jeder vorhandene Freitext wird zu einer Notiz.
-- `updated_at` ist die beste verfügbare Näherung für den Zeitpunkt.
-- Idempotent — läuft die Migration erneut, entstehen keine Duplikate.
-- ---------------------------------------------------------------------
insert into public.dd_project_notes (dd_project_id, occurred_on, source, note)
select
  p.id,
  coalesce(p.updated_at::date, current_date),
  'sonstiges',
  left(btrim(p.extra_user_context), 2000)
from public.dd_projects p
where p.extra_user_context is not null
  and length(btrim(p.extra_user_context)) > 0
  and not exists (
    select 1 from public.dd_project_notes n where n.dd_project_id = p.id
  );

comment on table public.dd_project_notes is
  'Gesprächsnotizen je DD-Projekt. Ersetzt dd_projects.extra_user_context (Spalte bleibt, wird nicht mehr gelesen).';
