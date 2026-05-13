-- =====================================================================
-- immotool — storage repair
-- Idempotently re-creates the property-images bucket and its RLS policies.
-- Migration 0001 originally set this up; this file is a safety net in case
-- the bucket was dropped manually or the policies got out of sync.
-- =====================================================================

-- Bucket (private — RLS-controlled).
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', false)
on conflict (id) do nothing;

-- Drop any leftover/old policy versions to avoid duplicates, then recreate.
drop policy if exists "property_images_select" on storage.objects;
drop policy if exists "property_images_insert" on storage.objects;
drop policy if exists "property_images_update" on storage.objects;
drop policy if exists "property_images_delete" on storage.objects;

create policy "property_images_select"
  on storage.objects for select
  using (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'viewer')
  );

create policy "property_images_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

create policy "property_images_update"
  on storage.objects for update
  using (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );

create policy "property_images_delete"
  on storage.objects for delete
  using (
    bucket_id = 'property-images'
    and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid, 'editor')
  );
