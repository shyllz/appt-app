-- ============================================================
-- Apartment app: front-page slideshow (several photos)
-- Both of you can add photos; the front page shows them as a
-- slideshow in random order.
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run even if 03_home.sql was never run (it creates what it needs).
-- ============================================================

create table if not exists public.home_photos (
  id       uuid primary key default gen_random_uuid(),
  path     text not null unique,                                   -- file in Storage bucket "home-photos"
  added_by uuid references auth.users(id) on delete set null default auth.uid(),
  added_at timestamptz not null default now()
);

-- ---------- Security ----------
alter table public.home_photos enable row level security;
grant select, insert, update, delete on public.home_photos to authenticated;
drop policy if exists "home_photos_all" on public.home_photos;
create policy "home_photos_all" on public.home_photos for all to authenticated using (true) with check (true);

-- ---------- Photo storage (same private bucket as before, max 15 MB, images only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-photos', 'home-photos', false, 15728640, array['image/*'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'home_photos_read') then
    create policy "home_photos_read" on storage.objects for select to authenticated using (bucket_id = 'home-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'home_photos_upload') then
    create policy "home_photos_upload" on storage.objects for insert to authenticated with check (bucket_id = 'home-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'home_photos_update') then
    create policy "home_photos_update" on storage.objects for update to authenticated using (bucket_id = 'home-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'home_photos_delete') then
    create policy "home_photos_delete" on storage.objects for delete to authenticated using (bucket_id = 'home-photos');
  end if;
end $$;

-- ---------- Keep the photo you already have (from 03_home.sql), if any ----------
do $$
begin
  if to_regclass('public.household') is not null then
    insert into public.home_photos (path, added_by, added_at)
    select photo_path, photo_by, coalesce(photo_at, now())
    from public.household
    where id = 1 and photo_path is not null
    on conflict (path) do nothing;
  end if;
end $$;

-- ---------- Live updates (the other phone sees new photos right away) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'home_photos') then
    alter publication supabase_realtime add table public.home_photos;
  end if;
end $$;
