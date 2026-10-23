# Security

## Trust boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ Browser — UNTRUSTED                                          │
│  IndexedDB, React state, everything the user can edit        │
│  May render anything. May not authorise anything.            │
└──────────────────────────┬──────────────────────────────────┘
                           │ session cookie + bearer token
┌──────────────────────────▼──────────────────────────────────┐
│ Next.js server — TRUSTED                                     │
│  Verifies the session on every request. Resolves prices.     │
│  Signs grants. Writes entitlements (via webhook).            │
└──────────────────────────┬──────────────────────────────────┘
                           │ service role / user token
┌──────────────────────────▼──────────────────────────────────┐
│ Postgres + RLS — TRUSTED, and the last line                  │
│  auth.uid() = user_id on every customer table.               │
└─────────────────────────────────────────────────────────────┘
```

The governing rule: **the client is trusted to render, never to authorise.** Every decision
about access, price or entitlement is made on the server.

## Authentication

Google OAuth via Supabase, PKCE. No passwords exist in this product, so there is no password
reset flow, no credential stuffing surface, and no password hashing to misconfigure.

Sessions live in cookies managed by `@supabase/ssr`. `middleware.ts` refreshes them on every
gated request. An expired access token without a refresh produces a signed-out state rather
than a half-authenticated one.

## Authorisation

| Resource | Control |
| --- | --- |
| A user's own rows | RLS `auth.uid() = user_id` |
| Another user's rows | Blocked by RLS; no API path bypasses it |
| Billing tables | Owner read-only; writes require the service role |
| `billing_events` | No client policy at all |
| `/admin/*` | Server-side owner allowlist plus `ADMIN_EMAILS`, checked in the layout |
| `/app/*` | Middleware session gate; page data is per-user from IndexedDB |

### Why admin is an env allowlist

A `profiles.role` column would be the obvious design, and it would be a privilege-escalation
path the moment users can update their own profile row. The owner email is allowlisted in
server code, while additional operators come from the `ADMIN_EMAILS` environment variable.
The check lives in `app/admin/layout.tsx`, so it covers every nested route by construction
rather than by each page remembering to call it.

## Secrets

| Secret | Exposure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public — it is a URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public — constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS entirely |
| `STRIPE_SECRET_KEY` | **Server only** |
| `STRIPE_WEBHOOK_SECRET` | **Server only** |
| `ENTITLEMENT_SIGNING_SECRET` | **Server only** |

Rules:

1. Nothing with the service role or a Stripe secret may be prefixed `NEXT_PUBLIC_`. Next.js
   inlines those into the client bundle; a mistake here is a full compromise.
2. `lib/supabase/admin.ts` is imported only by route handlers and server components. It is
   never imported by anything with `"use client"`.
3. Secrets are read from `process.env` at request time, not captured in module scope at build
   time, so a rotated key takes effect without a rebuild where the platform supports it.

## Payment integrity

Three independent protections, each of which alone would be insufficient:

1. **Price resolved server-side.** The browser sends `{ plan, interval }`. The server looks up
   the Stripe price ID from `lib/plans.ts` and the environment. A client cannot post a price
   ID, so it cannot buy Unlimited for $0.
2. **Signature verification.** The webhook verifies the Stripe signature over the raw body
   before any database work. An unsigned request is rejected.
3. **Entitlements written only by the webhook.** RLS grants the owner `select` on
   `billing_entitlements`, never `update` or `insert`. A user cannot grant themselves a tool.

Idempotency is enforced by the primary key on `billing_events.stripe_event_id`. A replayed
event hits `23505` and is acknowledged without applying twice.

## Offline grants

HMAC-SHA256 over `{ sub, plan, tools, iat, exp }`, signed server-side with
`ENTITLEMENT_SIGNING_SECRET`, valid 7 days.

- The client can verify but cannot mint. Without the secret, a forged grant fails the
  signature.
- The 7-day window bounds the damage from a cancellation.
- Rotating the secret invalidates all outstanding grants — offline users must reconnect once.

## CSRF

State-changing endpoints are `POST` and rely on the session cookie being `SameSite=Lax`,
which is Supabase's default. The Stripe webhook is authenticated by signature, not by cookie,
so CSRF does not apply to it.

There is no explicit CSRF token. If a cross-site form POST could trigger a state change,
`SameSite=Lax` blocks it for cookies but **not** for a `fetch` from an allowed origin. Adding
an origin check to `/api/account/delete` and `/api/stripe/*` is a cheap hardening step
recorded in the release checklist.

## Injection

- All database access goes through the Supabase client, which parameterises queries. There is
  no string-concatenated SQL in application code.
- The migration uses `format()` with `%I` for identifiers and is not reachable at runtime.
- React escapes interpolated content by default. There is no `dangerouslySetInnerHTML`
  anywhere in the app.
- CSV export quotes and escapes fields; a description containing `"` or a newline cannot break
  the file structure.

## Account deletion

`POST /api/account/delete`:

1. Rejects if Supabase is unconfigured (501) — never reports a deletion that did not happen.
2. Rejects if there is no session (401).
3. Rejects if the service role key is missing (501), with an explicit "nothing was deleted".
4. Calls `auth.admin.deleteUser(user.id)`, which cascades through every table.

The client clears IndexedDB **after** a successful response. Stripe records are retained and
the response says so.

## Rate limiting — not implemented

There is no rate limiter on `/api/sync`, `/api/stripe/checkout` or `/api/account/delete`. On a
platform with edge middleware this belongs there (per-user token bucket). Until it exists:

- `/api/sync` caps a batch at 100 mutations, which bounds a single request's cost.
- `/api/account/delete` is idempotent by nature — the second call has no user to delete.
- Checkout creation is the most abusable (it creates Stripe objects). It requires a valid
  session, which limits it to authenticated accounts.

This is a known gap, not an oversight.

## Audit

`audit_events` records `actor`, `action`, `entity`, `entity_id`, `metadata`, written by server
routes. It is not a security control — it is a record for operators, visible at `/admin`.

## Reporting

Security issues: the address in `ADMIN_EMAILS`, or the contact page. There is no bug bounty
programme, and claiming one exists would be dishonest.
