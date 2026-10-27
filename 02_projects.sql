-- ============================================================
-- Apartment app: section 2 – projects
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Run once, after 01_shopping.sql.
-- ============================================================

-- Rooms (editable in the app)
create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

-- Project types (editable in the app)
create table public.project_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

-- Projects
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  room_id     uuid references public.rooms(id) on delete set null,
  type_id     uuid references public.project_types(id) on delete set null,
  status      text not null default 'idea'
              check (status in ('idea', 'researching', 'in_progress', 'on_hold', 'done')),
  priority    text not null default 'medium'
              check (priority in ('high', 'medium', 'low')),
  owner       uuid references auth.users(id) on delete set null,   -- who's responsible
  due_date    date,
  budget      numeric(12, 2),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tasks / next steps
create table public.project_tasks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  text       text not null,
  assignee   uuid references auth.users(id) on delete set null,
  due_date   date,
  done       boolean not null default false,
  done_by    uuid references auth.users(id) on delete set null,
  done_at    timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Solutions & links found online (with optional price / quote)
create table public.project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url        text not null,
  title      text,
  note       text,
  price      numeric(12, 2),
  favorite   boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Actual costs (what we have spent)
create table public.project_costs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  description text not null,
  amount      numeric(12, 2) not null,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- Notes / log
create table public.project_notes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  body       text not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Photos & files (the file itself lives in Storage bucket "project-files")
create table public.project_files (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path       text not null,
  name       text not null,
  mime       text,
  size       bigint,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index project_tasks_project_idx on public.project_tasks(project_id);
create index project_links_project_idx on public.project_links(project_id);
create index project_costs_project_idx on public.project_costs(project_id);
create index project_notes_project_idx on public.project_notes(project_id);
create index project_files_project_idx on public.project_files(project_id);

-- Keep projects.updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------- Security: everything shared between logged-in users ----------
alter table public.rooms         enable row level security;
alter table public.project_types enable row level security;
alter table public.projects      enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_links enable row level security;
alter table public.project_costs enable row level security;
alter table public.project_notes enable row level security;
alter table public.project_files enable row level security;

grant select, insert, update, delete on
  public.rooms, public.project_types, public.projects, public.project_tasks,
  public.project_links, public.project_costs, public.project_notes, public.project_files
  to authenticated;

create policy "rooms_all"         on public.rooms         for all to authenticated using (true) with check (true);
create policy "project_types_all" on public.project_types for all to authenticated using (true) with check (true);
create policy "projects_all"      on public.projects      for all to authenticated using (true) with check (true);
create policy "project_tasks_all" on public.project_tasks for all to authenticated using (true) with check (true);
create policy "project_links_all" on public.project_links for all to authenticated using (true) with check (true);
create policy "project_costs_all" on public.project_costs for all to authenticated using (true) with check (true);
create policy "project_notes_all" on public.project_notes for all to authenticated using (true) with check (true);
create policy "project_files_all" on public.project_files for all to authenticated using (true) with check (true);

-- ---------- File storage (private bucket, max 25 MB per file) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 26214400)
on conflict (id) do nothing;

create policy "project_files_read"   on storage.objects for select to authenticated using (bucket_id = 'project-files');
create policy "project_files_upload" on storage.objects for insert to authenticated with check (bucket_id = 'project-files');
create policy "project_files_update" on storage.objects for update to authenticated using (bucket_id = 'project-files');
create policy "project_files_delete" on storage.objects for delete to authenticated using (bucket_id = 'project-files');

-- ---------- Live updates ----------
alter publication supabase_realtime add table
  public.rooms, public.project_types, public.projects, public.project_tasks,
  public.project_links, public.project_costs, public.project_notes, public.project_files;

-- ---------- Starter data (rename/delete freely in the app) ----------
insert into public.rooms (name, emoji, position) values
  ('Bedroom',         '🛏️', 0),
  ('Guest bedroom',   '🛋️', 1),
  ('Living room',     '📺', 2),
  ('Kitchen',         '🍳', 3),
  ('Bathroom',        '🛁', 4),
  ('Hallway',         '🚪', 5),
  ('Balcony',         '🌿', 6),
  ('Whole apartment', '🏠', 7);

insert into public.project_types (name, emoji, position) values
  ('Furniture & storage', '🗄️', 0),
  ('Decor',               '🖼️', 1),
  ('Renovation',          '🔨', 2),
  ('Repair & maintenance','🔧', 3),
  ('Tech & setup',        '💻', 4),
  ('Purchase',            '🛍️', 5);

-- Two example projects
insert into public.projects (title, description, room_id, type_id, status, priority)
values
  ('Wardrobe solution',
   'Custom corner wardrobe. In dialogue with a custom wardrobe maker – they have sent drawings.',
   (select id from public.rooms where name = 'Bedroom'),
   (select id from public.project_types where name = 'Furniture & storage'),
   'in_progress', 'high'),
  ('Home office setup',
   'Desk, chair and storage for working from home in the guest bedroom.',
   (select id from public.rooms where name = 'Guest bedroom'),
   (select id from public.project_types where name = 'Furniture & storage'),
   'researching', 'medium');

insert into public.project_tasks (project_id, text) values
  ((select id from public.projects where title = 'Wardrobe solution'), 'Go through the drawings from the wardrobe maker'),
  ((select id from public.projects where title = 'Wardrobe solution'), 'Send feedback / questions on the drawings'),
  ((select id from public.projects where title = 'Home office setup'), 'Add the solutions we have found online as links'),
  ((select id from public.projects where title = 'Home office setup'), 'Measure the wall space for the desk');
