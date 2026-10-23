# Deployment

## Prerequisites

- Node 20+ (the project targets the Next 16 runtime)
- A Supabase project with the migration applied
- A Stripe account with products, prices and a webhook endpoint
- A host that supports Next.js route handlers and server components (Vercel, or a Node host
  running `next start`)

## 1. Environment

Set every variable from `.env.example` in the host's environment settings. The minimum for a
working authenticated deployment:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENTITLEMENT_SIGNING_SECRET=
NEXT_PUBLIC_APP_URL=https://gridhub.online
```

Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the eight `STRIPE_PRICE_*` variables to
enable billing. The owner account is allowlisted for `/admin`; add `ADMIN_EMAILS` for other
operators.

`NEXT_PUBLIC_APP_URL` must match the deployed origin exactly — it is used to build absolute
Checkout success and cancel URLs, and a mismatch sends paying users to a host that will not
have their session. It defaults to `http://localhost:3000`, so leaving it unset in production
fails quietly at the worst moment.

## 2. Database

Apply any pending migrations **before** deploying code that expects them:

```bash
supabase link --project-ref <ref>
supabase db push
```

The country activity report requires `0002_country_activity.sql` to be applied. To run the
SQL files directly, apply `0001_init.sql` first, then `0002_country_activity.sql`.

Or `psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql`.

The migration is safe to re-run (`if not exists`, `create or replace`, `drop trigger if
exists`), but it will not change an existing column type. After launch, every schema change is
a new numbered file.

## 3. Build and deploy

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

`next build` is the gate that catches server/client boundary errors, so never deploy a build
that has not completed locally at least once.

**This build has not been deployed or compiled.** The commands above are the procedure, not a
record of a successful run.

## 4. Stripe webhook

Add the endpoint after the first successful deploy, because Stripe verifies reachability:

```
https://gridhub.online/api/stripe/webhook
```

Events: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`.

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy. Then send a test event and
confirm a row appears at `/admin/billing` with `processed_at` set.

## 5. Auth redirect URLs

In Supabase → Authentication → URL Configuration, add
`https://gridhub.online/auth/callback` to the redirect allowlist and set the Site URL. In Google
Cloud Console, the authorised redirect URI stays
`https://<project-ref>.supabase.co/auth/v1/callback` — it does not change per environment.

## 6. Service worker

`public/sw.js` is registered only in production. On every deploy that changes assets:

1. Bump `CACHE_VERSION` in `public/sw.js`.
2. Deploy.

The `activate` handler deletes caches whose names do not match the new version. Without the
bump, users keep a stale HTML shell pointing at deleted asset hashes and see a blank page
until they hard-refresh. This is the single most common PWA deploy failure.

## 7. Post-deploy verification

Run these against the live origin, in order:

| Check | Expected |
| --- | --- |
| `/` | Marketing home renders, no console errors |
| `/pricing` | Five tiers, monthly/annual toggle |
| `/login` | Google button, or the local-mode path if unconfigured |
| Sign in | Lands on `/onboarding` (new) or `/app` (returning) |
| `/app` | Dashboard, empty state if no tools activated |
| A tool | Create a record, reload, record persists |
| Offline (DevTools) | App still renders; indicator shows `pending` |
| `/admin/system` | Environment table, database reachable |
| Stripe test checkout | `/admin/billing` shows a processed event |

## 8. Monitoring

There is no APM integration in this build. The minimum viable observability:

- **Server errors**: the host's function logs. Route handlers `console.error` with a
  `[gridhub/<route>]` prefix.
- **Webhook health**: `/admin/billing` — a growing `error` column is the signal.
- **Schema reachability**: `/admin/system`.
- **Nothing client-side.** There is no error reporting SDK, so a broken client is invisible
  unless a user reports it. Adding Sentry (or equivalent) is the highest-value operational
  improvement available.

## 9. Rollback

- **Code**: redeploy the previous build on the host.
- **Service worker**: if a bad shell is cached, bump `CACHE_VERSION` and deploy; do not try to
  unregister from the client, because the user has to load the app to run that code.
- **Database**: there are no down-migrations. Restore from the Supabase backup, and treat any
  destructive migration as needing a manual, reviewed reversal plan.

## 10. Scaling notes

The current design is client-compute with a thin sync server. That scales cheaply because the
server does almost no work per user. The first things to change under real load:

1. `sync_records` will grow fastest — it mirrors every record. Partition by `user_id` or
   archive rows for inactive accounts.
2. `/api/sync` will need rate limiting before it needs optimisation.
3. `billing_events` grows forever by design. Retain for the period your accountant requires,
   then archive; do not delete, because it is the idempotency record.

## Hosts

Vercel is the path of least resistance (native Next 16 support, edge middleware, per-PR
previews). A Node host works with `next start` behind a reverse proxy; in that case make sure
the proxy forwards the raw body to `/api/stripe/webhook`, since signature verification needs
the unmodified bytes.
