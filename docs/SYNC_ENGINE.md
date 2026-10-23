# Sync engine

Local-first means a write succeeds when it commits to IndexedDB. Synchronisation is a
separate, background concern that can fail without affecting the user's ability to work.

## The two states

| State | Meaning |
| --- | --- |
| **Saved** | Committed to IndexedDB. Durable on this device. |
| **Synced** | Acknowledged by the server. Durable on other devices. |

The product must never blur these. `components/shell/sync-indicator.tsx` exists to keep them
distinct, and it reports six phases:

| Phase | Copy | Trigger |
| --- | --- | --- |
| `local` | "Saved on this device" | Local-only mode, no Supabase |
| `offline` | "Offline — changes saved locally" | `navigator.onLine === false` |
| `syncing` | "Syncing…" | Flush in progress |
| `synced` | "All changes synced" | Outbox empty, last flush ok |
| `pending` | "N changes waiting" | Outbox non-empty |
| `error` | "Sync failed — will retry" | Flush threw or the server refused |

`pending` with a non-zero count is shown whenever the outbox has rows, even if a flush just
succeeded partially. That is the honest reading: if rows remain, they are not synced.

## Write path

```
createRecord / updateRecord / removeRecord
        │
        ▼
db.transaction("rw", records, outbox)   ← atomic
        ├── records.put(row with dirty = 1)
        └── outbox.add({ id: uid("mut"), op, payload, attempts: 0 })
        │
        ▼
notify(toolId, collection)   ← every mounted table re-reads
```

The transaction is the critical part. Writing the record and enqueueing the mutation
separately would allow a crash between them, producing a record that exists locally and will
never be sent.

## Flush

`flushOutbox()`:

1. Read up to 50 outbox rows, oldest first.
2. `POST /api/sync` with `Authorization: Bearer <access token>` and the batch.
3. On response, delete **only** the entries the server acknowledged (`acked`).
4. For each conflict, leave the row in the outbox and record the reason.
5. Update `attempts` and `lastError` for anything unacknowledged.
6. Notify, so the indicator updates.

Only acknowledged entries are removed. A batch that partially succeeds loses nothing — the
unacknowledged rows are retried on the next flush.

### Idempotency

Each outbox row's `id` is generated client-side and sent as `client_mutation_id`. The server
records applied ids in `sync_mutations` (primary key). A retry after a timeout — where the
first request actually succeeded — is recognised and skipped.

Without this, every flaky connection would duplicate records.

## Server handler

`POST /api/sync`:

```
1. Verify the bearer token → user id. Reject 401 if absent.
2. Reject batches over 100 mutations.
3. For each mutation:
     a. If client_mutation_id already in sync_mutations → ack, skip.
     b. Read sync_records(user_id, record_id).
     c. If incoming.version <= existing.version → conflict, do not apply.
     d. Upsert sync_records, insert sync_mutations.
4. Return { acked: [...], conflicts: [...] }
```

The `user_id` comes from the verified token, never from the request body. A client cannot
write to another user's records by claiming a different id.

### Version guard

`version` is the concurrency control. The client increments on every local write; the server
refuses anything not strictly newer. This is last-writer-wins with a stale-write rejection —
it does not merge fields.

The consequence is deliberate: a conflict is **surfaced**, not silently resolved. Losing a
field because another device happened to save later is worse than a retry.

## Pull

`GET /api/sync?cursor=<timestamptz>`:

1. Return `sync_records` for this user with `updated_at > cursor`, plus a new cursor.
2. Client applies each row, **skipping** any record whose local copy has `dirty === 1` or a
   local version `>=` the incoming one.
3. Store the new cursor in `meta`.

The skip rule is what prevents a pull from destroying un-pushed local work. A record the user
edited offline is the newest truth for that record until its mutation is accepted.

## When sync runs

| Trigger | Where |
| --- | --- |
| App mount | `Providers` |
| `online` event | `Providers` |
| `visibilitychange` → visible | `Providers` |
| Manual "Sync now" | Settings |
| Indicator click | `SyncIndicator` |

There is no timer. Polling a sync endpoint on a phone is a battery and data cost for no
benefit; the events above cover the cases where a flush can plausibly succeed.

## Conflict handling — current state

A rejected write stays in the outbox with `attempts` incremented and `lastError` set. The
record remains visible locally and marked dirty.

What is missing: a UI that tells the user "this record was changed elsewhere" and offers
keep-mine / take-theirs. Today the retry simply fails again until the versions align (for
example after a successful pull). This is a real gap, recorded in `RELEASE_CHECKLIST.md`.

## Failure modes and their symptoms

| Symptom | Cause |
| --- | --- |
| Indicator stuck on `pending` | Outbox non-empty; a mutation keeps being rejected |
| Stuck on `error` | 401 (expired session) or 500; check the server log |
| `pending` count grows but nothing syncs | Session expired — the bearer token is stale |
| Records reappear after delete | Pull applied before the delete was pushed (should be prevented by `dirty`) |
| Duplicate records | `sync_mutations` missing or not keyed on the client mutation id |
| Data missing on a second device | Records created in local-only mode were never associated with an account |

## Why not CRDTs

A CRDT would merge concurrent edits automatically. It would also require every field to be
modelled as a mergeable type, which is a large tax on sixteen domains to solve a problem that
mostly does not occur: a single user editing one record on two devices at the same instant.

Last-writer-wins with a version guard, plus a visible conflict, is the right complexity for
this product. If collaborative workspaces ship, that decision should be revisited for the
tables that actually need it — not for all of them.
