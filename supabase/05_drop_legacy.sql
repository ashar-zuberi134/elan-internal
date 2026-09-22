-- ════════════════════════════════════════════════════════════════════════════
--  Elan Internal — drop the legacy blob tables
--
--  ⚠  DESTRUCTIVE AND IRREVERSIBLE. Run this LAST, and only after:
--      1. 01–04 have run and the new site is working against them
--      2. the archive has been checked:
--         elan-internal-archive/crm_contacts.xlsx   (3,094 contacts)
--         elan-internal-archive/gtm_leads.xlsx      (150 leads)
--         elan-internal-archive/multiples.xlsx      (158 precedents)
--         elan-internal-archive/tasks_snapshot.xlsx (safety copy)
--
--  The guard below refuses to drop `tasks_legacy` until the new tasks table
--  has at least as many rows, so a half-finished migration can't lose data.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  legacy_n int;
  new_n    int;
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'tasks_legacy_blob') then
    raise notice 'No legacy blob table present — nothing to verify.';
    legacy_n := 0;
  else
    select coalesce(jsonb_array_length(data -> 'tasks'), 0)
      into legacy_n from public.tasks_legacy_blob where id = 1;
  end if;
  select count(*) into new_n from public.tasks;

  if new_n < legacy_n then
    raise exception
      'Migration incomplete: new tasks table has % rows, legacy blob has %. Run 04_migrate_tasks.sql first.',
      new_n, legacy_n;
  end if;

  raise notice 'Tasks migration verified: % rows migrated (legacy blob had %).', new_n, legacy_n;
end $$;

-- Tabs being retired: CRM, Contact Finder, GTM.
drop table if exists public.crm               cascade;
drop table if exists public.crm_pending       cascade;
drop table if exists public.gtm               cascade;
drop table if exists public.multiples         cascade;
drop table if exists public.email_sync_config cascade;

-- Once you're happy, finish the job:
--   drop table public.tasks_legacy_blob;
