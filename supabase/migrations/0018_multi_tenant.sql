-- =====================================================================
-- 0018_multi_tenant
-- Mehrere Mietverträge pro Objekt erlauben (WGs, geteilte Einheiten,
-- aufeinanderfolgende Verträge mit Überlappung).
--
-- Bisher: tenants.property_id war UNIQUE -> max. 1 Mieter pro Objekt.
-- Jetzt: nur noch FK (kein UNIQUE) -> beliebig viele Tenants pro Objekt.
-- Bruttomiete im Cashflow wird zur Summe der einzelnen Kaltmieten.
--
-- Außerdem: View `active_tenants` für "läuft heute noch"-Logik
-- (unbefristet ODER befristet mit contract_end >= heute).
-- =====================================================================

-- ---------------------------------------------------------------------
-- UNIQUE-Constraint auf property_id entfernen — Name ist autogeneriert
-- ("tenants_property_id_key" im Default), aber wir lösen ihn dynamisch
-- auf, falls der Name in deinem Projekt anders ist.
-- ---------------------------------------------------------------------
do $$
declare
  cname text;
begin
  -- pg_attribute.attname ist Typ `name`; explizit nach text casten,
  -- sonst gibt es einen Operator-Mismatch beim Vergleich mit text[].
  select c.conname into cname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'tenants'
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attnum)
      from pg_attribute a
      where a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    ) = array['property_id']::text[];
  if cname is not null then
    execute format('alter table public.tenants drop constraint %I', cname);
  end if;
end $$;

-- Sicherheitshalber auch einen evtl. UNIQUE-Index auf property_id droppen
-- (manche Migrationspfade haben statt CONSTRAINT einen Index angelegt).
drop index if exists public.tenants_property_id_key;

-- Performance: weiterhin nach property_id filtern, jetzt aber non-unique.
create index if not exists tenants_property_id_idx on public.tenants(property_id);

-- ---------------------------------------------------------------------
-- View für "aktive" Mietverträge: unbefristet (is_fixed_term=false) ODER
-- befristet mit contract_end >= heute. Nutzt RLS der zugrundeliegenden
-- tenants-Tabelle (security_invoker=on), d. h. der Aufrufer sieht nur
-- Mieter, die er sowieso lesen darf.
-- ---------------------------------------------------------------------
create or replace view public.active_tenants
with (security_invoker = on)
as
select
  t.*,
  case
    when t.is_fixed_term = false then true
    when t.contract_end is null then true
    when t.contract_end >= current_date then true
    else false
  end as is_active
from public.tenants t;

-- PostgREST-Schema-Cache invalidieren — sonst kennt die API die View nicht.
select pg_notify('pgrst', 'reload schema');
