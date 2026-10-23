# Release checklist

Nothing ships until every box in **Gate 1** is ticked. A ticked box means someone ran the
command and saw the result — not that the code looks right.

## Current state

| Item | State |
| --- | --- |
| Source complete (16 tools, shell, billing, admin, schema) | ✅ |
| Dependencies installed cleanly | ✅ |
| Type check | ✅ zero errors |
| Lint | ✅ 0 errors, 24 warnings |
| Production build | ✅ 56/56 routes |
| Unit tests | ✅ 68/68 |
| Runtime smoke (`next start`, 7 routes) | ✅ all 200 |
| Playwright E2E executed | ❌ browsers installed, suite not run |
| Migration applied | ❌ |
| Google OAuth configured | ❌ |
| Stripe products and prices created | ❌ |
| Deployed | ❌ |

Gates 1 and 5 (partly) are satisfied. **Everything from Gate 2 onward is unverified**, because
none of it can be exercised without a database, an OAuth client and a Stripe account.

---

## Gate 1 — it builds and runs

- [x] `npm install` completes with no `ERESOLVE` (needs `@types/node@^22` and a direct `vite` for Vitest)
- [x] `npm run typecheck` passes with zero errors
- [x] `npm run lint` passes with zero errors
- [x] `npm run build` completes — 56/56 routes
- [x] `npm test` passes — **68/68**
- [x] `next start` serves `/`, `/pricing`, `/tools`, `/app`, `/admin`, `/login`, `/collections`
- [ ] `npm run dev` smoke-tested (production start was used instead)
- [x] All sixteen tool detail routes resolve via `generateStaticParams`

Fixed on the way to a green build, for the record: four `lib/tools/*.ts` files contained JSX
and had to become `.tsx`; `Button` with `asChild` + `icon` threw on Radix `Slot` until the
children were wrapped in `Slottable`; `/login` needed a `Suspense` boundary around
`useSearchParams`; and three calculation bugs were found by the first test run.

## Gate 2 — the data layer is real

- [ ] Migration applied; `/admin/system` reports "Database reachable"
- [ ] `rowsecurity = true` on every row of `pg_tables`
- [ ] Policies exist for every customer table (`pg_policies`)
- [ ] Second account cannot read the first account's rows via the anon key
- [ ] New sign-in creates `profiles`, `workspaces`, `user_preferences`,
      `billing_entitlements` via the trigger
- [ ] Create / edit / delete a record in every tool; survives reload
- [ ] CSV export opens correctly in a spreadsheet
- [ ] JSON export in Settings contains every record

## Gate 3 — offline and sync

- [ ] Service worker registers in a production build only
- [ ] With DevTools offline, the app renders from IndexedDB
- [ ] A record created offline persists after reload
- [ ] The indicator reads `pending` while offline — **not** `synced`
- [ ] Reconnecting flushes the outbox and the indicator clears
- [ ] Two devices, one account: a record created on A appears on B
- [ ] A rejected mutation stays in the outbox (nothing is silently dropped)

## Gate 4 — billing

- [ ] Eight `STRIPE_PRICE_*` variables set; `/admin/system` shows all "Set"
- [ ] Test checkout completes for each paid tier, monthly and annual
- [ ] `/admin/billing` shows `checkout.session.completed` with `processed_at` set
- [ ] `/admin/subscriptions` shows the correct plan and status
- [ ] Replaying the same event does not double-apply
- [ ] Portal opens and allows cancellation
- [ ] Cancellation sets `cancel_at_period_end`
- [ ] `invoice.payment_failed` sets `past_due` without revoking access immediately
- [ ] Offline grant verifies; a tampered grant is rejected
- [ ] **Paywall is enforced server-side** — see Open items

## Gate 5 — interface

- [ ] Every interactive icon animates on hover, click and keyboard focus
- [ ] `missingIconKeys(Object.keys(ICON_ALIASES))` returns `[]`
- [ ] Light, dark and system themes all render correctly
- [ ] `prefers-reduced-motion` disables animation
- [ ] `prefers-reduced-transparency` produces solid surfaces
- [ ] Keyboard-only pass: sign in, navigate, create a record, open a dialog, close it with Esc
- [ ] Focus is visible on every interactive element
- [ ] Mobile: bottom nav, no horizontal scroll, tables become cards
- [ ] Dialog content is reachable above the on-screen keyboard
- [ ] No layout shift on load

## Gate 6 — honesty

- [ ] No fabricated testimonial, customer count, revenue figure or benchmark anywhere
- [ ] Marketing previews labelled "Example"
- [ ] Unconfigured integrations say so in the UI
- [ ] Sync indicator never claims "synced" with a non-empty outbox
- [ ] No placeholder copy ("Lorem", "Coming soon" without a date)
- [ ] Privacy, terms and refund pages describe what the code actually does
- [ ] Contact page does not imply a form backend that does not exist

## Gate 7 — operations

- [ ] `ADMIN_EMAILS` set; `/admin` reachable by an operator and 403 for a normal user
- [ ] `/admin` is `noindex`
- [ ] `CACHE_VERSION` bumped in `public/sw.js` for this deploy
- [ ] Environment variables set on the host, not only locally
- [ ] Stripe webhook endpoint registered and verified against the live URL
- [ ] Auth redirect allowlist includes the production callback
- [ ] Rollback path understood (previous build + cache version bump)

---

## Open items — known incomplete, do not describe as done

| Item | Impact | Where |
| --- | --- | --- |
| **Paywall not server-enforced** | A user can open a tool route directly. Product boundary, not a security boundary. | `BILLING_ENTITLEMENTS.md` |
| Dashboard widget engine | Tables exist; no add/remove/reorder UI | `DASHBOARD_WIDGETS.md` |
| Install prompt | No in-app PWA install affordance | `PWA_OFFLINE.md` |
| Playwright specs | `test:e2e` is wired; no config or specs | `TESTING.md` |
| Conflict UI | Rejected writes retry silently; no merge/overwrite choice | `SYNC_ENGINE.md` |
| Rate limiting | None on `/api/sync`, checkout, account delete | `SECURITY.md` |
| CSRF origin check | Relies on `SameSite=Lax` | `SECURITY.md` |
| Sample-data loaders | `onLoadSample` prop exists; no tool supplies one | `components/tools/ledger-tool.tsx` |
| Kanban drag-and-drop | Board renders cards; no drag or keyboard move | `components/tools/tool-view.tsx` |
| Invoice PDF | Print CSS only; no PDF route | — |
| USDA food search | Env var documented; no fetch implementation | — |
| Storage persistence | `navigator.storage.persist()` not requested | `PWA_OFFLINE.md` |
| Error reporting | No client-side SDK; broken clients are invisible | `DEPLOYMENT.md` |
| Background sync | Closed tab does not upload | `PWA_OFFLINE.md` |
| Icon registry verification | Alias list never checked against the installed package | `ANIMATED_ICONS.md` |

## Sign-off

```
Build verified by:      ______________________  date: __________
Data layer verified by: ______________________  date: __________
Billing verified by:    ______________________  date: __________
Interface verified by:  ______________________  date: __________
Honesty review by:      ______________________  date: __________
```

If a line cannot be signed, the release is not ready. An unsigned checklist is more useful
than a signed one nobody believes.
