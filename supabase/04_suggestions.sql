-- ============================================================
-- Apartment app: section 4 – Suggestion box
-- Ideas for new features / improvements to the app itself.
-- Paste this whole file into Supabase → SQL Editor → Run.
-- ============================================================

create table public.suggestions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  details    text,
  status     text not null default 'new'
             check (status in ('new', 'planned', 'done', 'declined')),
  likes      uuid[] not null default '{}',                 -- who gave it a 👍
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  done_at    timestamptz
);

-- ---------- Security ----------
alter table public.suggestions enable row level security;
grant select, insert, update, delete on public.suggestions to authenticated;
create policy "suggestions_all" on public.suggestions for all to authenticated using (true) with check (true);

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.suggestions;
