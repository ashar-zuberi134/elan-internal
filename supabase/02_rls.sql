-- ════════════════════════════════════════════════════════════════════════════
--  Elan Internal — row level security
--
--  Previously every table was `using (true) with check (true)` with the anon
--  key published in a public GitHub repo, so anyone who found the URL could
--  read and overwrite everything. Now: signed-in users only. The anon role
--  keeps exactly one privilege — the ability to attempt a login.
--
--  Run after 01_schema.sql. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.people            enable row level security;
alter table public.tasks             enable row level security;
alter table public.mandala_cells     enable row level security;
alter table public.metrics_snapshots enable row level security;
alter table public.app_settings      enable row level security;

-- Drop any previous policies (including the old "Allow all") so re-running
-- this file always converges on the same state.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('people','tasks','mandala_cells','metrics_snapshots','app_settings')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── Read: any signed-in teammate ────────────────────────────────────────────

create policy "read: authenticated" on public.people
  for select to authenticated using (true);

create policy "read: authenticated" on public.tasks
  for select to authenticated using (true);

create policy "read: authenticated" on public.mandala_cells
  for select to authenticated using (true);

create policy "read: authenticated" on public.metrics_snapshots
  for select to authenticated using (true);

create policy "read: authenticated" on public.app_settings
  for select to authenticated using (true);

-- ── Write: any signed-in teammate ───────────────────────────────────────────
-- This is a 3-person internal tool; everyone may edit everyone's tasks and
-- any mandala cell. The write policies below pin created_by/updated_by to the
-- caller so the audit trail cannot be forged.

create policy "insert: authenticated" on public.tasks
  for insert to authenticated
  with check (created_by = auth.uid() and updated_by = auth.uid());

create policy "update: authenticated" on public.tasks
  for update to authenticated
  using (true)
  with check (updated_by = auth.uid());

create policy "delete: authenticated" on public.tasks
  for delete to authenticated using (true);

create policy "update: authenticated" on public.mandala_cells
  for update to authenticated
  using (true)
  with check (updated_by = auth.uid());

-- Mandala geometry is fixed at 9x9 and seeded by migration, so clients get no
-- insert/delete rights — they can only edit the cells that already exist.

create policy "update: authenticated" on public.app_settings
  for update to authenticated using (true) with check (true);

-- metrics_snapshots is written only by the Netlify functions using the
-- service_role key, which bypasses RLS. Clients read, never write.

-- ── Lock the anon role out of the data entirely ─────────────────────────────

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.tasks         to authenticated;
grant update                 on public.mandala_cells to authenticated;
grant update                 on public.app_settings  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Lets an open tab see another teammate's edit without a refresh.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tasks','mandala_cells'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
