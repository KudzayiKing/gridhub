# PWA and offline behaviour

Offline is not a degraded mode in Gridhub — it is the normal mode with an optional
network. The app is fully usable with no connection, and says so honestly when sync is
behind.

## Installability

| Requirement | Implementation |
| --- | --- |
| Manifest | `app/manifest.ts` (Next metadata route) |
| Name / short name | "Gridhub" / "Gridhub" |
| Start URL | `/app` |
| Display | `standalone` |
| Theme colour | Ivory in light, charcoal in dark (`viewport` export in `app/layout.tsx`) |
| Icons | `public/icons/icon.svg`, `public/icons/maskable.svg` (purpose `maskable`) |
| Service worker | `public/sw.js`, registered only in production |
| HTTPS | Required — `localhost` is exempt |

### Install prompt — not implemented

There is **no in-app install prompt** yet. The browser's own install affordance (Chrome's
address-bar icon, iOS Safari's Share → Add to Home Screen) works because the manifest is
valid, but Gridhub does not nudge, does not detect `beforeinstallprompt`, and does not show
an "Install app" banner.

If you add one, the constraints that matter:

- iOS Safari does not fire `beforeinstallprompt`. Any prompt must be an instruction sheet
  ("Share → Add to Home Screen"), not a button.
- Never show a prompt on first load. Show it after the user has created a record.
- Respect dismissal permanently, not per session.
- Do not claim "works offline" before the service worker has actually activated.

## Caching strategy

`public/sw.js` uses two versioned caches:

```
gridhub-v1-shell     navigations and the offline document
gridhub-v1-assets    hashed JS/CSS/font/image output
```

| Request | Strategy | Rationale |
| --- | --- | --- |
| Navigation (`mode: navigate`) | Network first → cache → `/offline` | Fresh HTML when online; a real page when not |
| Static assets (`/_next/static`, fonts, icons) | Cache first, revalidate in background | Content-hashed, so a cached copy is never stale |
| `/api/*` | **Never cached** | A cached sync or entitlement response is a lie the app will act on |
| Cross-origin | Passed through | No opaque responses in the cache |

Caches are versioned by name. Bumping `CACHE_VERSION` on deploy creates fresh caches and the
`activate` handler deletes the old ones, so a stale bundle cannot survive a release.

### Why `/api/*` is excluded

Two specific failure modes justify the rule:

1. A cached `/api/sync` POST response would make the client believe mutations were
   acknowledged when they were not — silently losing data.
2. A cached `/api/entitlements` response would keep a cancelled subscription working for as
   long as the cache lives, which is unbounded. The signed 7-day grant exists precisely to
   bound that; caching the endpoint would defeat it.

## The offline page

`/offline` is a static route. It explains that data is on the device and that changes will
sync, and links back to `/app`. It is served for navigations that cannot reach the network,
so it must not depend on any client-side data fetch.

## Storage

IndexedDB via Dexie (`lib/db.ts`):

| Store | Key | Indexes |
| --- | --- | --- |
| `records` | `id` | `toolId`, `collection`, `updatedAt`, `dirty`, `[toolId+collection]` |
| `outbox` | `id` | `recordId`, `createdAt`, `toolId` |
| `meta` | `key` | — |

`dbAvailable()` guards every access. IndexedDB is unavailable in some private-browsing modes
and can be evicted under storage pressure; when it is, the repository returns empty arrays
and writes throw a clear error rather than pretending to save.

### Persistence is not guaranteed

Browsers evict IndexedDB under pressure, and "Clear site data" wipes it. Two mitigations:

- `navigator.storage.persist()` is the correct request, but it is not called today.
- The export function in Settings writes every record to a JSON file. That is the real backup.

Never tell a user their data is safe because it is "in the app".

## Offline entitlements

A user who paid must be able to open their tools on a plane. A user who cancelled must stop
working within a bounded time.

`GET /api/entitlements` returns an HMAC-signed grant:

```
{ sub, plan, tools[], iat, exp: iat + 7 days } + signature
```

The client verifies the signature, and the grant is valid for seven days offline. The
trade-off is explicit and documented in `BILLING_ENTITLEMENTS.md`: a churner keeps access for
up to a week, which is preferable to breaking a paying user who lost signal.

## Testing offline (procedure)

None of this has been executed for this build. The steps, for when a shell is available:

1. `npm run build && npm start` (the service worker is production-only).
2. Load `/app`, create a record.
3. DevTools → Application → Service Workers → **Offline**.
4. Reload. The app must render from IndexedDB, not the offline page — the offline page is for
   navigations, not for a shell that is already cached.
5. Create another record. It must save and appear immediately.
6. The sync indicator must read "pending", not "saved".
7. Go back online. The indicator must clear to "synced" and the outbox must empty.

Step 6 is the one that catches dishonesty. An indicator that shows "synced" while offline is
a bug, not a cosmetic issue.

## Known gaps

- No background sync (`SyncManager`). A closed tab does not upload; sync runs on next open.
- No install prompt UI.
- `navigator.storage.persist()` not requested.
- No conflict UI. A rejected write leaves the local record intact and dirty; the user is not
  yet shown a merge or overwrite choice.
