-- =====================================================================
-- immotool — properties: kind classifier + parent self-reference (Bundle C2)
-- Distinguish Wohnung / Haus / Stellplatz / Gewerbe / Sonstiges and let a
-- "Haus" act as parent for sub-units.
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
