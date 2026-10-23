# Stripe setup

Five tiers, monthly and annual, via Stripe Billing. Checkout is hosted; the customer portal
is Stripe's; entitlements are written only by a verified webhook.

## 1. Products and prices

Create **one product per paid tier** (Free has no Stripe object), each with two recurring
prices:

| Tier | Monthly | Annual | Price env vars |
| --- | --- | --- | --- |
| Single | $3 | $29 | `STRIPE_PRICE_SINGLE_MONTHLY`, `STRIPE_PRICE_SINGLE_ANNUAL` |
| Plus | $7 | $69 | `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_ANNUAL` |
| Pro | $11 | $109 | `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` |
| Unlimited | $15 | $149 | `STRIPE_PRICE_UNLIMITED_MONTHLY`, `STRIPE_PRICE_UNLIMITED_ANNUAL` |

Set currency to USD to match `lib/plans.ts`, which renders `$`. If you price in another
currency, change `priceLabel` too — otherwise the marketing site will advertise dollars and
Stripe will charge something else.

Each price ID looks like `price_1AbCdE...`. The app stores the **ID**, never an amount.

## 2. Environment

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://gridhub.online
STRIPE_PRICE_SINGLE_MONTHLY=price_...
STRIPE_PRICE_SINGLE_ANNUAL=price_...
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_UNLIMITED_MONTHLY=price_...
STRIPE_PRICE_UNLIMITED_ANNUAL=price_...
```

`NEXT_PUBLIC_APP_URL` matters: Checkout success and cancel URLs are absolute and must
return the user to the same origin that created the session. It falls back to
`http://localhost:3000` when unset, which is wrong in production and will send paying users
to a dead host.

## 3. Why the price is resolved on the server

`app/api/stripe/checkout/route.ts` takes a plan id and an interval, looks the plan up in
`PLANS`, and reads the price ID from the environment itself.

The browser never sends a price, an amount, or a Stripe price ID. If it did, a user could
post `price_...` for a $0 test price and grant themselves Unlimited. Resolving server-side
makes that impossible regardless of what the client sends.

If the price ID for a plan is missing, the route returns an error and the UI says checkout
is not configured. It does not fall back to a nearby price.

## 4. Webhook

Endpoint: `POST https://gridhub.online/api/stripe/webhook`

Events to send:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Local development:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# prints whsec_... — put it in STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

### Handler guarantees

1. **Signature verified first.** An unsigned or mis-signed request is rejected before any
   database work.
2. **Idempotent.** The event is inserted into `billing_events` keyed on `stripe_event_id`. A
   duplicate delivery hits `23505` and is acknowledged as already-processed. Stripe retries;
   double-granting does not happen.
3. **Raw body.** The signature is computed over the exact bytes received, so the route reads
   the raw text body. Parsing to JSON first breaks verification.
4. **Entitlements are derived, not asserted.** The handler maps the Stripe price ID back to a
   plan, then writes `billing_subscriptions` and `billing_entitlements`. It never trusts a
   plan name from metadata alone.

## 5. Customer portal

`app/api/stripe/portal/route.ts` creates a billing portal session for the stored
`stripe_customer_id`. Configure the portal in Stripe (**Settings → Billing → Customer
portal**) to allow plan changes and cancellation; otherwise the portal opens but offers
nothing.

Cancellation sets `cancel_at_period_end`. Access continues until `current_period_end`, which
is the behaviour users expect and what `billing_entitlements.grace_until` exists to model.

## 6. Test cards

| Card | Behaviour |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 3220` | Requires 3DS authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0341` | Attaches, then fails on charge — good for `invoice.payment_failed` |

Use any future expiry and any CVC.

## 7. Verifying the integration honestly

A green Checkout page proves nothing about your webhook. The sequence that actually proves it:

1. Complete a test-mode checkout.
2. Open `/admin/billing`. A `checkout.session.completed` row must exist with `processed_at`
   set and `error` empty.
3. Open `/admin/subscriptions`. The plan and status must match what you bought.
4. Open `/admin/system` — all price variables should read "Set".
5. Cancel via the portal, then confirm `customer.subscription.updated` arrives and
   `cancel_at_period_end` becomes true.

If step 2 shows a row with an `error`, the webhook is reaching you and failing — read the
error column. If there is no row at all, the endpoint or the secret is wrong.

**None of this has been executed for this deployment.** No products exist yet, and
`billing_events` is empty. Treat the integration as unverified until the sequence above
passes.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `No signatures found matching the expected signature` | Wrong `STRIPE_WEBHOOK_SECRET`, or the body was parsed before verification |
| Checkout 400 "not configured" | A `STRIPE_PRICE_*` variable is missing for that plan/interval |
| Paid, tools still locked | Webhook not delivered, or the price ID does not match any plan mapping |
| Portal opens blank | Customer portal not configured in Stripe |
| Duplicate grants | Should be impossible — if it happens, check `billing_events` primary key exists |
