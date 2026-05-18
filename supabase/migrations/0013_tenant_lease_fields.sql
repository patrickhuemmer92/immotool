-- =====================================================================
-- 0013 — Mietvertrags-Felder am bestehenden Single-Tenant
-- Eine Mietpartei pro Property — bei Mehrfamilienhäusern werden die
-- einzelnen Einheiten über parent_property_id als eigene properties
-- angelegt, jede mit ihrem eigenen tenants-Row.
-- =====================================================================

alter table public.tenants
  add column if not exists is_fixed_term boolean not null default false,
  add column if not exists contract_end date,
  add column if not exists cold_rent_per_month numeric(12,2);

-- contract_end darf nur gesetzt sein wenn is_fixed_term true ist,
-- und muss >= contract_start liegen.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_lease_check'
  ) then
    alter table public.tenants
      add constraint tenants_lease_check check (
        (is_fixed_term = false and contract_end is null)
        or (is_fixed_term = true and contract_end is not null
            and (contract_start is null or contract_end >= contract_start))
      );
  end if;
end$$;
