-- ============================================================
-- Apartment app: section 1 – shared shopping lists
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run once on a fresh project.
-- ============================================================

-- People in the household (display names for "added by")
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- Shopping lists (Groceries, Apartment, Pharmacy …)
create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text,
  position   int  not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Items on a list
create table public.items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists(id) on delete cascade,
  name       text not null,
  quantity   text,
  category   text not null default 'Other',
  checked    boolean not null default false,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  added_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index items_list_id_idx on public.items(list_id);

-- ---------- Security ----------
-- Only logged-in users get access. New sign-ups are switched off in
-- Supabase Auth, so the only logged-in users are the two of you.
alter table public.profiles enable row level security;
alter table public.lists    enable row level security;
alter table public.items    enable row level security;

grant select, insert, update, delete on public.profiles, public.lists, public.items to authenticated;

-- Profiles: everyone in the household can see names; you can only edit your own
create policy "profiles_read"   on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Lists and items: fully shared between household members
create policy "lists_all" on public.lists for all to authenticated using (true) with check (true);
create policy "items_all" on public.items for all to authenticated using (true) with check (true);

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.profiles, public.lists, public.items;

-- ---------- Starter lists ----------
insert into public.lists (name, emoji, position) values
  ('Groceries', '🛒', 0),
  ('Apartment', '🛋️', 1);
