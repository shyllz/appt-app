-- ============================================================
-- Apartment app: shopping – your own categories
-- Saved categories you add yourselves (e.g. "Furniture", "Tools").
-- They show up in the category picker for every list, for both of you.
-- One-time categories are NOT stored here – they only live on the item.
-- Paste this whole file into Supabase → SQL Editor → Run.
-- ============================================================

create table public.shopping_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  position   int  not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Security ----------
alter table public.shopping_categories enable row level security;
grant select, insert, update, delete on public.shopping_categories to authenticated;
create policy "shopping_categories_all" on public.shopping_categories for all to authenticated using (true) with check (true);

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.shopping_categories;
