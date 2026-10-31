# Workspace scope contract (Phase 0)

**Status:** Phase 1 implementation contract; owner-only workflows are implemented locally, collaboration remains disabled.
**Updated:** 2026-10-31

This document defines the scope and migration rules for the workspace implementation. It is based on `cross-tool-workspace-audit.md` and verified against the current local-first store and sync implementation. Phase 1 adds workspace-aware app code and an additive SQL migration. The user reports applying the migration; a read-only check confirms the expected schema in the currently configured Supabase project, but its staging/production identity and end-to-end authorization remain unverified.

## Identity and relationships

| Concept | Identity / relationship | Scope and rule |
|---|---|---|
| User | Supabase `auth.users.id` | Authenticated account principal. The server derives this from the verified session; clients never choose the owner. Local IndexedDB currently has no account identity, so legacy local records are not automatically attributable. |
| Workspace | Stable UUID `id`, `owner_id`, `kind`, name | Top-level record ownership boundary. Each account has one default Personal workspace; users may create additional Personal or Business workspaces. One workspace may contain multiple businesses and projects. |
| Workspace membership | `(workspace_id,user_id)` plus role | Store foundation exists, but sharing is disabled. Phase 1 initially authorizes only the workspace owner. Do not interpret role labels as permission until role checks and RLS are implemented and tested. |
| Business | Stable UUID; `workspaceId` required | A business belongs to one workspace; one workspace can hold multiple businesses. Currency and fiscal-year settings belong to the business. Business records also carry `businessId`. |
| Project | Reuse existing stable Project ID; `workspaceId` required | Project belongs to one workspace. Tasks and milestones retain `projectId`; dependencies must resolve to tasks in the same workspace and project context. Do not create another project entity. |
| Property | Reuse existing stable Property ID; `workspaceId` required | Units, bookings, expenses, and maintenance keep `propertyId`. A property may optionally relate to a business, but remains valid as a personal asset. |
| Wedding/Event | New stable event ID, `workspaceId` required | Guest, vendor, payment, expense, table, and task records need a consistent event parent. Do not assume old rows belong to one event when this cannot be established. |
| Content plan | Stable ID; `workspaceId` required; optional brand identity | A named plan organizes a content calendar. It is separate from a platform, channel account, and campaign. |
| Channel account | Stable ID, workspace, platform, user-facing account name/handle | Distinguishes multiple accounts on the same platform. Platform itself is a category, not an identity. |
| Campaign | Stable ID and workspace; optional association to multiple plans | A campaign is a marketing initiative and may span plans/channels. Keep it distinct from the plan and channel account. |
| Content item | Stable ID and workspace; optional plan | Store the common draft/body once. Publication/destination rows track per-account scheduling/status/metadata to support cross-posting without duplicating the source item. |
| Budget plan | No new parent by default | Existing month/category budgets and transactions remain the model. Add a separate budget-plan entity only after product approval and a clear need; do not duplicate transactions to represent plans. |
| Cash forecast / scenario | A forecast plan may contain many scenarios; each forecast item must identify its scenario | Scenario is the calculation context; items cannot be implicitly shared by array order. Any “All Forecasts” view must define aggregation and currency rules. |
| Other personal tool records | `workspaceId` required in the shared record envelope | Workspace ownership only; no artificial business/project/plan identifiers for Nutrition or Habits absent a product requirement. |

## Record envelope and local-first contract

The local envelope now adds optional `workspaceId` and `ownerUserId` outside opaque domain JSON, alongside `id`, `toolId`, `collection`, timestamps, soft-delete state, version, and dirty state. These fields remain optional solely for pre-workspace legacy rows. New writes require the active workspace context. Collection names and record IDs remain stable. Domain IDs remain in record data and express parent-child links. Collection queries, change notifications, outbox draining, and sync cursors include the workspace and owner boundary.

Client-generated UUIDs are used for workspaces and child records, allowing a workspace and its records to be created offline before cloud confirmation. A workspace's local owner association must be stored separately from a display name. No write may commit without a known active workspace ID. In local-only mode, a private local workspace can be created and used without Supabase; cloud sync can attach it only after an authenticated ownership decision.

All local changes remain atomic: write record envelope and enqueue mutation in the same IndexedDB transaction. Pending mutations survive workspace changes and retry. Scope changes cannot drop a dirty record, outbox row, or soft delete. Existing IndexedDB rows without ownership fields are retained but hidden from normal workspace queries until the user explicitly associates them. Pulls refuse to overwrite an unscoped or foreign-workspace row with a colliding ID. The database itself remains one Dexie database, but every data query and mutation is partitioned by stable workspace and owner IDs; account switching changes the active scope without clearing the other accounts' cache.

## Access contract

- Phase 1 launches owner-only workspace operations. `workspace_members` remains a dormant foundation for collaboration.
- The authenticated user is derived server-side. Every workspace read and mutation verifies that the user owns the workspace. User-provided `workspaceId`, `businessId`, or parent ID alone grants no access.
- Every referenced parent is checked for matching workspace and applicable domain scope. A task cannot point at another workspace's project; an invoice payment cannot point across businesses.
- RLS must enforce the same predicates as server handlers. Sharing is not enabled until owner/member role policies, direct database access, sync push/pull, and membership revocation are covered by security tests.
- “All” filters affect only reads/reports. Create and update operations require a concrete workspace and, when applicable, concrete business/project/plan/scenario.

## Migration compatibility contract

1. Keep IndexedDB collection names and stable record IDs. Add indexes additively; never reset the database.
2. Keep old app assets from overwriting or widening workspace-scoped data. Use an explicit sync protocol/capability version. Legacy clients lacking workspace context may be served only a safe default-workspace compatibility view; they must not pull every workspace or write unscoped records after cutover.
3. Cloud legacy rows are attributable to the authenticated account because they are fetched from that account's `sync_records` partition. They may be proposed for the unique default Personal workspace only when exactly one such workspace is verified.
4. Existing browser IndexedDB rows do not contain trusted account identity. Do not attach them automatically on sign-in, even if one workspace exists. Preserve records and outbox, quarantine them for reconciliation, and require an explicit user/account association before uploading them.
5. Preserve payload JSON, IDs, creation/update times, version, deleted state, dirty state, and every pending mutation. Never infer a business, event, content plan, or channel from a transaction description, amount, date, category, post text, or platform.
6. Workspaces with zero or multiple default Personal records, records pointing to foreign/stale workspaces, orphaned outbox entries, duplicate IDs, or invalid parents go to a review report; the preflight does not mutate or delete them.
7. Backfill and verify before enabling writes. Keep the legacy path and a backup/export through a stated rollback window. Cut over only after per-user/tool/collection counts, IDs, versions, deletes, references, and pending queues reconcile.

## Currency and aggregate contract

Never sum monetary values across currencies without explicit conversion. “All Businesses”, “All Properties”, and cross-context dashboards default to separate currency groups, comparisons, or per-entity rows. If conversion is introduced later, record rate source, effective date, display currency, and whether historical values are retranslated. Fiscal year/time-zone and date-range semantics are explicit per report.

## Phase 1 release gate

Before production rollout, Phase 1 must prove:

- One account can own multiple workspaces and each record resolves to exactly one.
- Owner-only server, RPC, and RLS authorization rejects forged workspace IDs and parent references.
- Account switching cannot expose or sync the previous account's IndexedDB data.
- A local-only workspace and pending outbox survive offline/reconnect without duplicate IDs or dropped deletes.
- Scoped pull/cursors cannot merge another workspace's rows into the cache.
- Old clients cannot broaden access; their write behavior and compatibility window are explicit.
- Membership revocation/collaboration stays disabled until separately approved and validated.

Implementation note: the selector and scoped writes are present in the app. The user reports running `0008_workspace_foundation.sql`, and the expected schema is present in the configured project. Deployment is still gated on identifying that project, verifying migration history and backfill, running cross-account/RLS/RPC integration tests in a known staging database, and reconciling existing local data before production rollout.
