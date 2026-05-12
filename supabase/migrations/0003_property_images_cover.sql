-- =====================================================================
-- immotool — property_images.is_cover (Bundle A)
-- Explicit cover flag with a partial-unique constraint so each property
-- has at most one cover image.
-- =====================================================================

alter table public.property_images
  add column if not exists is_cover boolean not null default false;

create unique index if not exists property_images_one_cover_per_property
  on public.property_images(property_id)
  where is_cover = true;
