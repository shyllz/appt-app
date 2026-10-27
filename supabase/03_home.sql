-- ============================================================
-- Apartment app: section 3 – Home (front page)
-- Shared front-page photo that both of you can change.
-- Paste this whole file into Supabase → SQL Editor → Run.
-- ============================================================

-- One shared row for household-wide settings (only id = 1 exists)
create table public.household (
  id         int primary key default 1 check (id = 1),
  photo_path text,                                          -- file in Storage bucket "home-photos"
  photo_by   uuid references auth.users(id) on delete set null,
  photo_at   timestamptz
);
insert into public.household (id) values (1);

-- ---------- Security ----------
alter table public.household enable row level security;
grant select, insert, update on public.household to authenticated;
create policy "household_all" on public.household for all to authenticated using (true) with check (true);

-- ---------- Photo storage (private bucket, max 15 MB, images only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-photos', 'home-photos', false, 15728640, array['image/*'])
on conflict (id) do nothing;

create policy "home_photos_read"   on storage.objects for select to authenticated using (bucket_id = 'home-photos');
create policy "home_photos_upload" on storage.objects for insert to authenticated with check (bucket_id = 'home-photos');
create policy "home_photos_update" on storage.objects for update to authenticated using (bucket_id = 'home-photos');
create policy "home_photos_delete" on storage.objects for delete to authenticated using (bucket_id = 'home-photos');

-- ---------- Live updates (the other phone sees a new photo right away) ----------
alter publication supabase_realtime add table public.household;
