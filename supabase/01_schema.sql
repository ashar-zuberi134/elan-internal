-- ════════════════════════════════════════════════════════════════════════════
--  Elan Internal — schema
--  Project: sofzlqjszuskvwlkxvhr
--  Run this in the Supabase SQL editor. Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Shared helpers ──────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── people ──────────────────────────────────────────────────────────────────
-- Fixed roster. Referenced by tasks and by the mandala owner tags.

create table if not exists public.people (
  id         text primary key,
  label      text        not null,
  role       text        not null,
  owner_code text        not null unique,     -- 'CEO' | 'Pres' | 'CTO' — mandala owner tag
  accent     text        not null,            -- hex colour for the UI stripe
  sort_order smallint    not null default 0,
  created_at timestamptz not null default now()
);

insert into public.people (id, label, role, owner_code, accent, sort_order) values
  ('yash',  'Yash',  'CEO',       'CEO',  '#F4A261', 1),
  ('rohit', 'Rohit', 'President', 'Pres', '#E76F51', 2),
  ('ashar', 'Ashar', 'CTO',       'CTO',  '#a78fef', 3)
on conflict (id) do update
  set label      = excluded.label,
      role       = excluded.role,
      owner_code = excluded.owner_code,
      accent     = excluded.accent,
      sort_order = excluded.sort_order;

-- ── tasks ───────────────────────────────────────────────────────────────────
-- One row per task. This replaces the single-JSONB-blob table, which made
-- deletes impossible to persist and silently lost concurrent edits.

create table if not exists public.tasks (
  id           uuid        primary key default gen_random_uuid(),
  person_id    text        not null references public.people(id) on update cascade,
  title        text        not null check (length(btrim(title)) > 0),
  description  text        not null default '',
  due_date     date,
  status       text        not null default 'active' check (status in ('active','done')),
  position     double precision not null default 0,   -- manual ordering within a column
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  legacy_id    text unique,                            -- provenance from the old blob

  -- completed_at is set if and only if the task is done
  constraint tasks_completed_at_matches_status check (
    (status = 'done' and completed_at is not null) or
    (status = 'active' and completed_at is null)
  )
);

create index if not exists tasks_person_status_idx on public.tasks (person_id, status);
create index if not exists tasks_due_date_idx      on public.tasks (due_date) where status = 'active';

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Keep completed_at consistent automatically, so clients can't violate the
-- constraint above just by flipping status.
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status = 'active' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_completed on public.tasks;
create trigger tasks_sync_completed before insert or update on public.tasks
  for each row execute function public.tasks_sync_completed_at();

-- ── mandala ─────────────────────────────────────────────────────────────────
-- 9 blocks x 9 slots, laid out reading-order (TL -> BR). Block 4 is the CORE.
--   kind='cell'     — an ordinary goal cell (label + owner + term + tip)
--   kind='center'   — a block's centre theme label
--   kind='surround' — one of the 8 theme labels ringing the CORE
--   kind='core'     — the fixed centre goal
-- Every position is materialised as a row, so there is no sparse-override
-- merge logic on the client. default_* holds the seeded value so that
-- "Reset to default" is a pure server-side operation.

create table if not exists public.mandala_cells (
  block_index   smallint not null check (block_index between 0 and 8),
  slot          smallint not null check (slot between 0 and 8),
  kind          text     not null check (kind in ('cell','center','surround','core')),
  block_name    text     not null,

  label         text     not null default '',
  owner_code    text     check (owner_code in ('CEO','Pres','CTO','All')),
  term          char(1)  check (term in ('N','L')),
  tip           text     not null default '',

  default_label text     not null default '',
  default_owner text     check (default_owner in ('CEO','Pres','CTO','All')),
  default_term  char(1),
  default_tip   text     not null default '',

  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null,

  primary key (block_index, slot),

  -- goal cells carry owner + term; label-only cells must not
  constraint mandala_cell_shape check (
    (kind = 'cell' and owner_code is not null and term is not null) or
    (kind <> 'cell')
  )
);

drop trigger if exists mandala_touch on public.mandala_cells;
create trigger mandala_touch before update on public.mandala_cells
  for each row execute function public.touch_updated_at();

-- ── metrics_snapshots ───────────────────────────────────────────────────────
-- Server-side metric history. Replaces per-browser localStorage caching, so
-- every teammate sees the same numbers and we accumulate a real time series.

create table if not exists public.metrics_snapshots (
  id          bigserial   primary key,
  source      text        not null check (source in ('ga4','linkedin_company','linkedin_person')),
  metric_key  text        not null,
  value       numeric,
  payload     jsonb       not null default '{}'::jsonb,
  captured_on date        not null default current_date,
  captured_at timestamptz not null default now(),
  unique (source, metric_key, captured_on)
);

create index if not exists metrics_recent_idx
  on public.metrics_snapshots (source, metric_key, captured_on desc);

-- ── app_settings ────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('founded_on',      '"2025-05-24"'::jsonb),
  ('core_goal',       '"25 Deals\nClosed by\nApril 2029"'::jsonb),
  ('ga4_property_id', '"540549544"'::jsonb)
on conflict (key) do nothing;

drop trigger if exists settings_touch on public.app_settings;
create trigger settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();
