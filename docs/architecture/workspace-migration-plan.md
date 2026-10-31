# Workspace migration and rollback plan (Phase 0)

**Status:** Phase 0 plan plus Phase 1 additive migration implementation. User reports applying `0008_workspace_foundation.sql`; read-only schema checks confirm the expected relations/columns in the configured Supabase project, but the project environment and backfill reconciliation are not confirmed.
**Production data touched:** unknown. Do not infer staging versus production from `.env.local` alone.

## Source data that must be preserved

The active local store keeps `LocalRecord` rows keyed by record ID with tool, collection, JSON payload, timestamps, version, deleted, and dirty fields. The outbox separately stores mutation ID, record ID, operation, serialized payload, attempts, and error. Supabase stores user-scoped JSON rows in `sync_records`. Existing collection keys and IDs are data contracts.

The browser database's old rows do not store a trusted authenticated `userId` on each local record or outbox row. They survive sign-out. Phase 1 adds owner/workspace fields to new rows and filters all active queries, outbox operations, and cursors by scope. Old unscoped rows remain intact and hidden until the user explicitly associates them; sync pulls also refuse to overwrite an unscoped row with a colliding ID.

## Preflight and migration sequence

1. **Read-only inventory:** export (a) each account's cloud sync rows, (b) each browser's local records and outbox, and (c) workspace ownership/default markers. Keep local and cloud snapshots distinct. Record tool/collection counts, record IDs, payload hashes, version/deleted/dirty state, parent IDs, and mutation IDs. Do not merge the snapshots yet.
2. **Reconcile workspace identity:** verify one default Personal workspace for each authenticated account. Generate stable UUIDs only for missing local-only workspaces. If there is no unique default or ownership is unclear, stop that account and produce a reconciliation report.
3. **Plan cloud legacy rows:** rows fetched within the authenticated user's server partition may be proposed for the unique default Personal workspace. Do not infer any `businessId`, event ID, content plan, or channel. Keep the row's record ID and domain JSON unchanged.
4. **Plan local rows:** preserve all rows. Do not upload unattributed rows automatically on sign-in. Show a reconciliation interface that lets the user associate local-only records with the account/workspace or export them; make no destructive choice by default. Carry all outbox mutations forward byte-for-byte until the user resolves ownership.
5. **Additive schema/client rollout:** `0008_workspace_foundation.sql` adds workspace/default/archive metadata and `sync_records.workspace_id`, backfills each account's cloud rows to its default Personal workspace, adds owner-only RLS and scoped RPC authorization, and preserves the legacy RPC/HTTP behavior as a default-workspace-only compatibility route. The client uses protocol version 2, an additive Dexie version 2 schema, and workspace-specific cursors. The user reports applying the SQL; verify migration history, backfill, old/new-client behavior, and authorization in a known staging project before rollout.
6. **Backfill in bounded batches:** use an idempotent migration ledger keyed by account, workspace, record ID and migration version. Update only records with a verified mapping. If retried, the same mapping is a no-op; a conflicting mapping is surfaced and halted.
7. **Reconcile:** compare before/after counts and hashes by user/workspace/tool/collection; verify every original record, delete marker, version, parent reference and pending mutation is accounted for exactly once. Check currencies and unresolved assignments separately.
8. **Cut over:** enable workspace reads/writes only after reconciliation and authorization checks pass. Keep dual-read/legacy compatibility until old clients have a defined safe behavior and pending queues are drained.

## Rollback

- Before any write migration, rollback is simply disabling the feature flag and keeping the existing app path.
- For staged writes, retain an immutable snapshot plus a migration ledger recording each old/new scope mapping. Roll back only workspace envelope/scope fields using that ledger; do not overwrite domain payloads, IDs, timestamps, versions, or deletes.
- Never roll back by reimporting a full old snapshot over newer user edits. Restore only records whose workspace mapping was changed by the migration and whose current version/hash still matches the migration's expected post-state. Conflicts require a reconciliation report.
- Keep new and old sync endpoints/protocols isolated. A rollback must not let an old client pull records from multiple workspaces or overwrite scoped rows with unscoped payloads.
- Any further production migration requires a separately reviewed change, a fresh backup, measured rollback procedure, and explicit approval. The user reports running `0008`; its target environment and resulting data reconciliation are not yet verified.

## Fixture and acceptance test set

`tests/workspace-migration-preflight.test.ts` exercises a read-only planner against these Phase 0 cases:

- empty new account;
- existing cloud records for all 16 registered tools;
- existing account with one populated tool;
- multiple locally created unsynced records with pending outbox mutations and unknown owner;
- unscoped legacy and already-scoped record shapes representing old/new record envelopes;
- soft-deleted cloud record, version metadata, mixed currency payload;
- existing project and property parent references;
- zero/ambiguous default workspace;
- foreign workspace reference;
- outbox mutation whose local record is missing;
- deterministic preflight retry after interruption.

The preflight is deliberately not a data migrator. Actual IndexedDB-to-workspace and cloud-schema migration tests must be added with Phase 1's implementation and run against fixtures plus a staging clone before rollout. “Passing” Phase 0 tests therefore proves only that the read-only assignment policy does not propose unsafe ownership or drop pending mutations; it is not approval to migrate production data.
