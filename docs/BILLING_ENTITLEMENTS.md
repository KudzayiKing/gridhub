# Billing and entitlements

## Plans

Defined once in `lib/plans.ts`. Prices are USD, monthly and annual.

| Plan | Monthly | Annual | Tools included |
| --- | --- | --- | --- |
| Free | $0 | $0 | 1 (the budget planner, basic) |
| Single | $3 | $29 | 1 paid tool |
| Plus | $7 | $69 | 3 |
| Pro | $11 | $109 | 6 |
| Unlimited | $15 | $149 | All 16 |

`toolLimit` is the number of **paid** tools a plan unlocks. `recommendPlan(n)` returns the
cheapest plan covering `n` tools, which is what onboarding uses instead of a hard-coded
suggestion. `plansCovering(n)` returns every option, so the UI can show "Plus also works,
for $4 less".

Annual pricing is a discount, not a different product: the same Stripe price objects, a
different interval.

## The entitlement record

`billing_entitlements` is the single authoritative answer to "what may this account use".

```sql
create table public.billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  tools text[] not null default array['budget'],
  status text not null default 'free',
  current_period_end timestamptz,
  grace_until timestamptz,
  updated_at timestamptz not null default now()
);
```

Why an explicit `tools` array rather than deriving from `plan`:

- A Single subscriber chooses **which** tool. The plan says "one"; the array says which one.
- `subscription_tool_selections` records the choice; `billing_entitlements.tools` is the
  resolved result the app reads.
- Downgrades can leave a grace window where the old tool set is still readable.

## Write path

```
Stripe ──webhook──► /api/stripe/webhook ──service role──► billing_entitlements
                                              │
                                              └──────────► billing_subscriptions
```

No client path writes these tables. RLS grants the owner `select` only. If a client could
`update billing_entitlements`, every paywall in the product would be decorative.

The new-user trigger seeds a `free` entitlement row, so a signed-in user always has an
entitlement to read rather than a null that every consumer has to special-case.

## Read path

`GET /api/entitlements` (server, session-verified) returns the row plus a signed offline
grant. The client never computes entitlement from the plan name it last saw.

## Offline grants

The hard problem: a user on a plane must still open the tools they paid for, but a client
must not be able to mint its own permission.

Solution — a server-signed, time-boxed grant:

```
payload  = { sub: userId, plan, tools[], iat, exp: iat + 7 days }
signature = HMAC-SHA256(payload, ENTITLEMENT_SIGNING_SECRET)
```

Properties:

- Signed **server-side only**. `ENTITLEMENT_SIGNING_SECRET` never reaches the browser.
- Valid for **7 days**. Long enough for a trip, short enough that a cancelled subscription
  stops working without a network call.
- Verified before use. A tampered payload fails the signature and the app falls back to the
  last known online entitlement, or to free.

The trade-off is explicit: someone who cancels and then stays offline for up to a week keeps
access. That is a deliberate product decision — punishing a paying user who lost signal is
worse than a week of over-grant to a churner. If that trade-off changes, shorten `exp`; do
not remove the signature.

## Enforcement points

| Point | Enforced by | Strength |
| --- | --- | --- |
| Reading another user's rows | RLS `auth.uid() = user_id` | Hard — the database refuses |
| Writing billing state | Service role only | Hard |
| Signing offline grants | Server HMAC | Hard |
| Creating a Checkout session for a plan | Server resolves the price | Hard |
| Which tools appear in the workspace | Client, from `tool_activations` + entitlement | **Soft** |

## What is not enforced yet — read this

The client decides which tools to **display** from the user's activations. It does not
prevent a determined user from opening a tool route directly.

This is a real limitation, stated plainly:

- The tool routes are client-rendered and read from IndexedDB. There is no server component
  that refuses to render `/app/business/invoicing` without an entitlement.
- Consequently the paywall is a **product** boundary today, not a security boundary.
- What *is* protected: other people's data (RLS), billing records (service role), and offline
  grants (HMAC). A user cannot obtain another account's data or write their own entitlement.

Closing the gap properly means checking `billing_entitlements` in a server layout for
`/app/[collection]/[tool]` and returning a 402/upgrade view. That is the correct next step
before charging real money at scale, and it is recorded in `RELEASE_CHECKLIST.md` as an open
item rather than quietly assumed to work.

## Grace and dunning

`invoice.payment_failed` sets status `past_due`. Access continues to
`current_period_end`, then to `grace_until` if set. Nothing deletes data on downgrade —
records stay readable and exportable, which is both kinder and required by the refund policy.
