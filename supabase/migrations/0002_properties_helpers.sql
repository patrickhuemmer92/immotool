-- =====================================================================
-- immotool — properties helpers (MS5)
-- RPC to atomically replace the owner-share assignments of a property.
-- The deferred constraint trigger property_owners_sum_check fires at the
-- end of the function's transaction, so a 60/30 split is rejected.
-- =====================================================================

create or replace function public.set_property_owners(
  p_property_id uuid,
  p_shares jsonb            -- [{ "owner_id": "<uuid>", "ownership_share": 0.6 }, ...]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_property_member(p_property_id, 'editor') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.property_owners where property_id = p_property_id;

  if p_shares is null or jsonb_array_length(p_shares) = 0 then
    return;
  end if;

  insert into public.property_owners (property_id, owner_id, ownership_share)
  select
    p_property_id,
    (elem->>'owner_id')::uuid,
    (elem->>'ownership_share')::numeric
  from jsonb_array_elements(p_shares) as elem;
end;
$$;
