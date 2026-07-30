-- ---------------------------------------------------------------------
-- Migration 0030: property_type auf DD-Projekt (+ Onboarding-Projekt).
--
-- Grund: die DD-Prompts sind aktuell WEG-lastig — bei einem 8-Fam-MFH
-- fragt die KI nach Teilungserklärung / WEG-Protokollen, die es dort
-- gar nicht gibt. Mit explizit vorgewählter Objektart können wir:
--   - typ-spezifische Prompts fahren (kein WEG-Content bei MFH)
--   - typ-spezifische Doku-Empfehlungen zeigen (bei MFH: Mieteraufstellung
--     statt Wirtschaftsplan)
--   - typ-spezifische Findings/Fragen erzeugen
--
-- Werte:
--   etw_weg    - Eigentumswohnung in WEG-Struktur (Default für v1)
--   mfh        - Mehrfamilienhaus (klassisches Zinshaus, ganzes Objekt)
--   efh        - Einfamilienhaus / Doppelhaushälfte / Reihenhaus
--   gewerbe    - Reines Gewerbeobjekt
--   mixed      - Wohn-/Gewerbe-Misch (typisch: EG Laden + Wohnungen)
--   other      - Sonstiges
--
-- Kein Enum-Typ, sondern text mit CHECK — flexibler, wir können später
-- ohne Migration erweitern.
-- ---------------------------------------------------------------------

alter table public.dd_projects
  add column if not exists property_type text
    check (property_type in ('etw_weg', 'mfh', 'efh', 'gewerbe', 'mixed', 'other'));

comment on column public.dd_projects.property_type is
  'Objektart-Vorwahl vor Upload — steuert typ-spezifische Prompts, Doku-Empfehlungen und Findings.';

-- Onboarding: hilfreich für Wizard-Steuerung (bei MFH gleich Sub-Property-
-- Anlage anbieten, bei ETW nicht). property_type kann null bleiben — dann
-- wird beim Confirm gefragt.
alter table public.onboarding_projects
  add column if not exists property_type text
    check (property_type in ('etw_weg', 'mfh', 'efh', 'gewerbe', 'mixed', 'other'));

comment on column public.onboarding_projects.property_type is
  'Objektart-Vorwahl — analog zu dd_projects.property_type.';

-- ---------------------------------------------------------------------
-- Freifeld für zusätzlichen Käufer-Kontext.
-- Fließt in den Konsolidierungs-Prompt ein — z.B. „Verkäufer erwähnte
-- Dachschaden aus 2024" oder „Wir wollen selbst einziehen".
-- ---------------------------------------------------------------------
alter table public.dd_projects
  add column if not exists extra_user_context text;

comment on column public.dd_projects.extra_user_context is
  'Freifeld: zusätzliche Info vom Käufer die die KI beim Konsolidieren berücksichtigen soll.';

-- ---------------------------------------------------------------------
-- dd_documents.kind um MFH-relevante Typen erweitern.
-- Wir droppen den alten CHECK und legen ihn neu an, damit die Menge
-- der erlaubten Werte kontrolliert wächst.
-- ---------------------------------------------------------------------
alter table public.dd_documents
  drop constraint if exists dd_documents_kind_check;

alter table public.dd_documents
  add constraint dd_documents_kind_check check (kind in (
    'expose',
    'weg_minutes',
    'wirtschaftsplan',
    'teilungserklaerung',
    'energieausweis',
    'grundriss',
    'grundbuchauszug',
    'mieterliste',
    'other'
  ));
