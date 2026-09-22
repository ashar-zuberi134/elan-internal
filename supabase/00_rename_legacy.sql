-- ════════════════════════════════════════════════════════════════════════════
--  Elan Internal — step 0: get the legacy `tasks` name out of the way
--
--  The old blob table is also called `tasks`, so 01_schema.sql's
--  CREATE TABLE IF NOT EXISTS would silently no-op and the new schema would
--  never be created. Rename it out of the way first; it is dropped in 05.
--
--  ⚠  Generate 04_migrate_tasks.sql BEFORE running this file — the generator
--     reads /rest/v1/tasks, which points at the new table once this has run.
--
--  Run first. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  -- Only rename if `tasks` is still the old single-row blob shape
  -- (a `data jsonb` column), never a partially-migrated new table.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tasks' and column_name = 'data'
  ) then
    alter table public.tasks rename to tasks_legacy_blob;
    raise notice 'Renamed legacy public.tasks -> public.tasks_legacy_blob';
  else
    raise notice 'No legacy blob table to rename — skipping.';
  end if;
end $$;
