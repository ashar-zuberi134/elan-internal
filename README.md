# Elan — Internal

Internal tool for the Elan Advisors team. Three tabs: **Mandala**, **Metrics**, **Live Tasks**.

Static site (no build step, no framework) on Netlify, backed by one Supabase
project. Sign-in required.

- Live: https://elan-internal.netlify.app
- Supabase project: `sofzlqjszuskvwlkxvhr`

---

## Layout

```
index.html              single page, three tab panels
style.css
js/
  config.js             Supabase URL + anon key, founding date
  supabase.js           client
  auth.js               sign-in gate, user chip
  ui.js                 escaping, toast, confirm dialog
  mandala.js            Mandala tab
  metrics.js            Metrics tab
  tasks.js              Live Tasks tab
  app.js                bootstrap, tab routing, module lifecycle
netlify/functions/
  analytics.js          GA4 Data API proxy (service account)
  linkedin.js           RapidAPI proxy + shared daily cache
supabase/               migrations and seed generators
dev/smoke.html          local-only harness (see below)
```

## Data model

One row per thing. Nothing is a JSON blob.

| Table | Rows | Purpose |
|---|---|---|
| `people` | 3 | Fixed roster. Drives task columns, mandala owner tags, legend colours. |
| `tasks` | one per task | Live Tasks. |
| `mandala_cells` | 81 | Every grid position, keyed `(block_index, slot)`. `default_*` columns back "Reset to default". |
| `metrics_snapshots` | one per source/key/day | Shared metric cache and history. |
| `app_settings` | key/value | Founding date, core goal, GA4 property id. |

`tasks` and `mandala_cells` are in the `supabase_realtime` publication, so an
open tab reflects a teammate's edit without a refresh.

### Why this changed

The old build kept **all** tasks in a single JSONB blob and rewrote the whole
blob on each change, merging local state over remote:

```js
const merged = [ ...remote.filter(t => !localIds.has(t.id)), ...tasks ];
```

A deleted task is absent from `localIds`, so the remote copy passed that filter
and was written straight back — **deletes could never persist**. Concurrent
edits also silently clobbered each other, and write failures were swallowed
into `console.error`, so a failed save looked exactly like a successful one.

---

## Cutover runbook

Run in this order. Steps 1–2 happen before anything is renamed.

**1. Generate the tasks migration from the current live blob.**
The team is actively using the old site, so snapshot at cutover, not earlier.

```bash
SUPABASE_ANON_KEY='<legacy anon key>' node supabase/gen_tasks_migration.mjs
```

Writes `supabase/04_migrate_tasks.sql`. It refuses to generate if any row has a
blank title, unknown person, or `done` without a `completedAt`.

**2. Run the SQL, in order, in the Supabase SQL editor.**

| File | What it does |
|---|---|
| `00_rename_legacy.sql` | Renames the legacy `tasks` blob table out of the way. Must run before `01`, or `CREATE TABLE IF NOT EXISTS tasks` silently no-ops. |
| `01_schema.sql` | Creates the five tables, constraints, triggers. |
| `02_rls.sql` | RLS scoped to `authenticated`; revokes everything from `anon`; enables realtime. |
| `03_seed_mandala.sql` | Seeds all 81 mandala positions. |
| `04_migrate_tasks.sql` | Loads the tasks from step 1. |

All are idempotent — safe to re-run.

**3. Create the three users.**
Supabase dashboard → Authentication → Users → Add user (email + password,
auto-confirm). One each for Yash, Rohit, Ashar. There is no public sign-up:
`anon` has no insert rights anywhere, so accounts can only be created here.

**4. Set the Netlify environment variables.**

| Variable | Used by | Notes |
|---|---|---|
| `GA_SERVICE_ACCOUNT` | `analytics.js` | Already set. Full service-account JSON. |
| `RAPIDAPI_KEY` | `linkedin.js` | **Rotate first** — the old key shipped in client JS in a public repo. |
| `SUPABASE_URL` | `linkedin.js` | `https://sofzlqjszuskvwlkxvhr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `linkedin.js` | Writes the shared metric cache. Server-side only — never in client code. |

**5. Deploy and verify.** Sign in, confirm all three tabs load, add a task,
delete it, reload — it stays deleted.

**6. Only then, drop the legacy tables.**

```
05_drop_legacy.sql
```

Destructive and irreversible. It refuses to run if the new `tasks` table has
fewer rows than the legacy blob. Drops `crm`, `crm_pending`, `gtm`,
`multiples`, `email_sync_config`. It leaves `tasks_legacy_blob` in place; drop
that by hand once you're satisfied.

Archived first to `../elan-internal-archive/` as JSON and Excel:
`crm_contacts` (3,094), `gtm_leads` (150), `multiples` (158), `tasks_snapshot`.

---

## Local development

```bash
python3 -m http.server 3333
```

Then open <http://localhost:3333>. The Netlify functions don't run under a
plain static server, so Metrics shows "Unavailable" for LinkedIn and Website —
that's expected. Use `netlify dev` if you need them.

### Smoke harness

`dev/smoke.html` renders all three tabs against a fake session and a stubbed
PostgREST, so the UI can be exercised without touching the database — useful
before the migration has run, and for testing edge cases (overdue tasks, long
labels, hostile input). It emulates PostgREST closely enough to exercise the
real client paths, including the `Accept: application/vnd.pgrst.object+json`
header that `.single()` sends.

It is blocked in production by a 404 redirect in `netlify.toml`. Keep it that
way; it is a development tool, not a login bypass (the fake JWT would be
rejected by RLS anyway).

### Regenerating seeds

```bash
node supabase/gen_mandala_seed.mjs      # -> 03_seed_mandala.sql  (81 rows)
node supabase/gen_tasks_migration.mjs   # -> 04_migrate_tasks.sql
```

`supabase/mandala_defaults.js` is the source of the mandala defaults. It is a
seed-time artefact only — the app reads the database, not this file.

---

## Security

- **Sign-in required.** Every table is behind RLS scoped to `authenticated`;
  `anon` is revoked from all tables, sequences and functions. The anon key in
  `js/config.js` is a public identifier by design — on its own it can only
  attempt a login.
- `created_by` / `updated_by` are pinned to `auth.uid()` by the write policies,
  so the audit trail can't be forged by a client.
- All user-entered text is escaped before it reaches `innerHTML` (`js/ui.js`).
- `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, and a restrictive
  `Permissions-Policy` are set in `netlify.toml`.

### Still outstanding

- **Rotate `RAPIDAPI_KEY`.** The old value was committed to a public repo in
  `app.js` and should be treated as compromised.
- **Consider making the GitHub repo private.** Nothing secret remains in it,
  but it is an internal tool.

---

## Removed

The CRM, Contact Finder and GTM tabs were retired, along with
`netlify/functions/apollo.js` (Apollo enrichment) and
`netlify/functions/email-sync.js` (scheduled Outlook → Claude → CRM sync).

The email sync had never worked in production: it wrote to `crm_pending` and
`email_sync_config`, neither of which existed — `scripts/setup-supabase.sql`
was never run — so the scheduled function had been failing every 30 minutes.
