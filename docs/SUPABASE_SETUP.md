# Supabase setup

Gridhub uses Supabase for three things only: authentication, Postgres, and row-level
security. It is **not** used as the primary data store from the client's perspective — the
client reads IndexedDB and syncs. That distinction drives everything below.

## 1. Project

The supplied project:

| Setting | Value |
| --- | --- |
| URL | `https://nzcwmarlkdmgssrllsqn.supabase.co` |
| Publishable key | `sb_publishable_QBzDRfpYlZTwvzdKKipDZA_YmiE6_-i` |

The publishable (anon) key is safe to ship in the browser — it is constrained by RLS. The
**service role key is not**, and must never appear in a `NEXT_PUBLIC_*` variable.

## 2. Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://nzcwmarlkdmgssrllsqn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_QBzDRfpYlZTwvzdKKipDZA_YmiE6_-i

# Server only. Project Settings → API → service_role.
SUPABASE_SERVICE_ROLE_KEY=

# 32+ random bytes, e.g. openssl rand -base64 48
ENTITLEMENT_SIGNING_SECRET=

# Optional additional operators; the owner account is built into the server allowlist.
ADMIN_EMAILS=you@example.com
```

`isSupabaseConfigured()` checks only the two public values. If either is absent the app runs
in **local-only mode**: no sign-in, no sync, no billing, and the UI says so explicitly rather
than failing silently.

## 3. Apply the migration

```bash
supabase link --project-ref nzcwmarlkdmgssrllsqn
supabase db push
```

or

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
```

The migration is idempotent (`create table if not exists`, `create or replace function`,
`drop trigger if exists` before create). Re-running it will not destroy data, but it also
will not alter an existing column's type — for schema changes after launch, write a new
numbered migration.

### Verify it actually applied

Do not assume. Open `/admin/system`; it runs a count against `public.profiles` and reports
either "Database reachable" or the exact Postgres error. A reachable database with a missing
table and an unreachable database are different problems and the page distinguishes them.

Apply new numbered migrations (including `0002_country_activity.sql`) with `supabase db push`
before deploying features that depend on them. The owner account is allowlisted in server
code; add any additional operators to `ADMIN_EMAILS` on the production host.

## 4. Confirm RLS is on

In the SQL editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every row should read `rowsecurity = true`. If any is `false`, that table is readable by
anyone holding the anon key — treat it as a security incident, not a to-do.

Then confirm the policies exist:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## 5. Auth settings

Under **Authentication → URL Configuration**:

| Field | Value |
| --- | --- |
| Site URL | `http://localhost:3000` in development, `https://gridhub.online` otherwise |
| Redirect URLs | `http://localhost:3000/auth/callback`, `https://gridhub.online/auth/callback` |

The callback path is fixed: `app/auth/callback/route.ts` exchanges the PKCE code and then
sends the user to `/onboarding` (new) or `/app` (returning). A redirect URL that is not
allowlisted produces a silent bounce back to the login page — see
[`GOOGLE_AUTH.md`](GOOGLE_AUTH.md).

## 6. What the client is allowed to do

| Operation | Path | Trust |
| --- | --- | --- |
| Read own rows | Direct PostgREST, RLS-enforced | Client may call it |
| Write own records | `/api/sync` with a bearer token | Server verifies the user, then writes |
| Read entitlements | `/api/entitlements` | Server-signed response |
| Write entitlements | Stripe webhook, service role | Client cannot reach this |

There is no client path that writes `billing_entitlements`. That is the point.

## 7. Rotating keys

- **Publishable key**: rotate in the dashboard, update the env var, redeploy. Existing
  sessions survive.
- **Service role key**: rotate, update the server env var, redeploy immediately. Any
  in-flight webhook retries will fail signature-independent auth until the redeploy lands.
- **`ENTITLEMENT_SIGNING_SECRET`**: rotating it invalidates every outstanding offline grant.
  Offline users will need to reconnect once to obtain a new grant. Rotate deliberately, not
  casually.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Signed in, immediately bounced to `/login` | `/auth/callback` not allowlisted |
| `permission denied for table ...` | RLS enabled, policy missing, or `user_id` not set |
| Sync returns 401 | No session, or the bearer token was not attached |
| Everything renders but nothing saves | IndexedDB blocked (private mode / storage pressure) |
| Admin shows dashes everywhere | `SUPABASE_SERVICE_ROLE_KEY` missing |
