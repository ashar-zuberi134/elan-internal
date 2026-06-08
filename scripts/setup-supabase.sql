-- Run this in the Supabase SQL editor for project sofzlqjszuskvwlkxvhr
-- https://supabase.com/dashboard/project/sofzlqjszuskvwlkxvhr/sql/new

-- Pending contacts queue (detected from emails, awaiting review)
create table if not exists crm_pending (
  id   bigint primary key,
  data jsonb  not null default '{"items": []}'::jsonb
);
insert into crm_pending (id, data) values (1, '{"items": []}')
  on conflict (id) do nothing;

-- Email sync config (last sync timestamp + rotated refresh token)
create table if not exists email_sync_config (
  id            bigint primary key,
  last_sync     timestamptz,
  refresh_token text
);
insert into email_sync_config (id) values (1)
  on conflict (id) do nothing;

-- RLS policies (allow all — internal tool, no public access)
alter table crm_pending       enable row level security;
alter table email_sync_config enable row level security;

create policy "Allow all" on crm_pending       for all using (true) with check (true);
create policy "Allow all" on email_sync_config for all using (true) with check (true);
