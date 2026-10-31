# Workspace implementation progress

**Last updated:** 2026-10-31
**Overall status:** Phases 0–8 have local implementations; release remains blocked on Phase 1 staging database and authorization verification.

## Phase 0 — Preparation, Compatibility & Migration Safety

**Status:** Complete for the read-only scope contract, migration planning, and dry-run preflight. No production or local user records were migrated.

### Files

- `docs/architecture/cross-tool-workspace-audit.md`
- `docs/architecture/workspace-scope-contract.md`
- `docs/architecture/workspace-migration-plan.md`
- `lib/workspaces/migration-preflight.ts`
- `tests/workspace-migration-preflight.test.ts`

### Validation

- Targeted preflight tests passed in Phase 0 (10 tests).
- Typecheck and focused lint passed in Phase 0.
- The then-current full suite had two unrelated failures in `tests/chrome-tokens.test.ts`.

## Phase 1 — Shared Workspace Foundation

**Status:** Implemented in the working tree. The user reports applying `0008_workspace_foundation.sql`; read-only REST checks confirm the expected schema in the currently configured Supabase project. Which environment that project represents is unconfirmed, and staging authorization/data-reconciliation acceptance remains unverified.

### Files changed

- `supabase/migrations/0008_workspace_foundation.sql` — additive workspace metadata, default Personal workspace backfill, `sync_records.workspace_id`, owner-only RLS, scoped RPC, and legacy default-workspace compatibility. User reports applying it; see post-migration smoke check below.
- `app/api/workspaces/route.ts` — authenticated owner-only list/create/rename/archive/restore/delete handlers, including stable client UUIDs for connecting offline workspaces.
- `app/api/sync/route.ts` — protocol v2 push/pull scoped to verified owner workspaces; legacy clients stay limited to the default workspace.
- `lib/workspaces/context.ts` — active workspace scope and envelope ownership check.
- `lib/db.ts`, `lib/types.ts`, `lib/store.ts` — additive Dexie indexes and workspace/owner envelope fields; reads, writes, and change notifications use the active scope; legacy rows remain preserved and unscoped until explicit association.
- `lib/sync.ts` — workspace-scoped outbox batches and cursors, authenticated owner checks, and protection against pulling over unscoped/foreign rows.
- `components/shell/workspace-switcher.tsx`, `components/shell/app-shell.tsx`, `app/app/layout.tsx` — desktop/mobile selector, cached signed-in workspace list for offline access, device-only workspace creation and explicit account connection, owner-context loading gate, and explicit legacy-record association UI.
- `app/app/settings/page.tsx` — export, clear-cache, and account-delete operations no longer indiscriminately clear other workspace/account caches.
- `lib/i18n.ts` — translations for the new workspace UI in Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic.
- `tests/workspace-scope.test.ts` — account/workspace isolation and legacy-quarantine contract tests.

### Database migration and compatibility

- Migration `0008_workspace_foundation.sql` is additive and retry-oriented. The configured Supabase project currently exposes the expected workspace tables and columns. The migration ledger, backfill results, and RPC authorization have not been verified end to end.
- The app now expects the migration to be applied before authenticated workspace loading can complete. Without it, the selector shows an error/retry state and private app content remains gated.
- Cloud rows are assigned to the default Personal workspace by authenticated account; no business/project/property ownership is inferred.
- Old clients use only the default workspace path. Local old rows have no trusted account identity and are not automatically attached or synced.
- Collaboration roles remain disabled; only owners can use workspaces and scoped sync.

### Post-migration read-only smoke check — 2026-10-31

- User reports running `0008_workspace_foundation.sql`.
- Read-only requests to the Supabase project configured in `.env.local` returned HTTP 200 for `workspaces` (`id`, `owner_id`, `kind`, `is_default`), `workspace_members` (`workspace_id`, `user_id`, `role`), and `sync_records.workspace_id`. The service-role requests returned one sample row per relation without printing row contents.
- Anonymous publishable-key reads for those three relations returned HTTP 200 with zero visible rows. The workspace tables were nonempty to the service-role requests, so the results are consistent with owner-only RLS; this is not a forged-owner or cross-account authorization test.
- This confirms schema presence in the configured project only. The project’s staging/production identity, migration ledger version, backfill completeness, record reconciliation, authenticated owner access, RPC compatibility, and sync behavior remain unverified.

### Tests and checks

- `npm test -- --run tests/workspace-scope.test.ts tests/workspace-migration-preflight.test.ts tests/i18n-coverage.test.ts` — passed, 20 tests.
- `npm run build` — passed.
- `npm run typecheck` — passed as part of the production build.
- Focused ESLint and `git diff --check` — passed after the final changes.
- `npm test` — 21 files passed, 1 file failed (229 tests passed, 2 failed). Both failures are the existing `tests/chrome-tokens.test.ts` `--nav-solid` expectations (`#fcfcfa` / `#121214` versus `var(--chrome-solid)`). Workspace/i18n tests pass after adding translations.

### Phase 1 acceptance results

- Workspace selector and owner-only create/rename/archive/restore/delete code: **implemented; API not yet run against migrated Supabase**.
- Local record queries and writes isolated by workspace and owner: **implemented; pure scope tests pass**.
- Offline workspace list, local workspace creation, and explicit reconnect/claim path: **implemented; IndexedDB browser integration not yet exercised**.
- Workspace-scoped sync and old-client default-workspace compatibility: **implemented in code; RPC/RLS staging tests not yet run**.
- Legacy local records preserved and never automatically assigned: **implemented; explicit association action available**.
- Cross-workspace access rejected: **route/RPC checks implemented; database integration tests still required**.
- Existing cloud records preserved and associated to default Personal: **migration reports completion; actual record counts and payload reconciliation are not verified**.
- All Phase 1 acceptance criteria passing: **no**. The phase is not complete until the migration is applied to a staging clone, account-switch and RLS/RPC tests pass, and local/offline/outbox migration behavior is verified.

### Known limitations / release gates

- Do not deploy the new authenticated workspace shell to another environment until that environment has migration `0008_workspace_foundation.sql` and passes the owner/RLS and sync acceptance checks; the shell intentionally fails closed instead of showing unscoped records.
- Before treating the reported migration as production-ready, identify whether the configured project is staging or production, verify migration history, test two accounts and multiple workspaces (including forged workspace IDs, legacy clients, soft deletes, retries, and account switching), and reconcile counts/IDs/versions/pending queues.
- Existing unscoped local data can be associated explicitly by the user. A staging rehearsal must verify duplicate cloud/local IDs and server-version conflict behavior before enabling broad migration instructions.
- Full suite still has the two unrelated Chrome token failures noted above.
- No production migration, collaboration, or next roadmap phase has been run.

## Phase 2 — Multi-business Bookkeeping

**Status:** Implemented locally and unit/type/build checked. Cross-account staging validation and interactive browser QA remain. No records were reassigned or migrated.

### Files changed

- `lib/types.ts` — optional `businessId` relationships on bookkeeping transactions, accounts, and contacts; optional transaction currency retained for currency-safe reporting.
- `lib/tools/business.tsx` — business-scoped transaction/account/contact tabs, required business selection for new entries, and same-business account/contact reference checks.
- `components/tools/bookkeeping-businesses.tsx` — All Businesses default, business selector, create/edit/archive/restore controls, per-business summaries, currency-separated All Businesses reporting, selected-business monthly chart, explicit unassigned legacy summary, and scope-aware export payload.
- `components/tools/tool-view.tsx`, `components/tools/ledger-tool.tsx` — route Bookkeeping through the multi-business view and include real scoped records in the tool JSON export.
- `components/data/record-form.tsx` — disabled legacy “unassigned” choice for editing old records and surfaced actionable domain validation errors.
- `lib/i18n.ts` — labels and messages for the business controls translated for Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic.
- `tests/bookkeeping-business-scope.test.ts` — coverage for All Businesses/legacy visibility, selected-business filtering, inherited currency, and cross-business references.

### Phase 2 acceptance results

- Default scope is All Businesses; selection is held only in page state and resets when reopening the tool: **implemented**.
- Transactions, accounts, and contacts filter to the selected business; new records require an explicit business: **implemented**.
- Account/contact references are validated against the selected business: **implemented and unit checked**.
- Per-business KPIs and charts use only the selected business; All Businesses totals are grouped by business and currency, with no cross-currency sum: **implemented**.
- Bookkeeping JSON exports include actual records and respect the selected business; table CSV exports use the current tab filter: **implemented**.
- Old business-unassigned rows remain unassigned and visible in All Businesses. No inferred assignment, data copy, SQL domain-table write, or local migration was performed: **implemented**.
- Create/edit/archive/restore business controls: **implemented**.
- `npm run typecheck`, targeted Bookkeeping/workspace/i18n tests, focused ESLint, and production build: **passing** (see current run summary; existing warnings in `lib/tools/business.tsx` are unchanged).
- Interactive desktop/mobile QA, live cloud sync persistence, real-user record-count reconciliation, and phase-wide AI/background integration scoping: **not verified**.

### Release gate

Phase 2 does not close the Phase 1 release gate. Apply and validate `0008_workspace_foundation.sql` in staging, test authenticated scope/RLS/sync and local outbox behavior, then verify Bookkeeping create/edit/archive/filter/export against a staging clone. Do not deploy this working tree before those checks.

## Phase 3 — Projects multi-project workspace support

**Status:** Implemented locally and focused unit/type/build checked. Interactive browser QA and workspace staging validation remain.

### Implementation

- Reused the existing stable `Project` IDs and `projectId` links on tasks and milestones; no duplicate project model or relational SQL migration was added. Workspace isolation comes from the active workspace-scoped record envelope established in Phase 1.
- Added a single Projects scope selector with **All Projects** as the default. Invalid, deleted, or stale selections resolve to All Projects.
- Applied the selected scope consistently to project board tasks, project/milestone/dependency tables, project status chart, and project KPI calculations.
- Dependency rows in an individual project view appear only when both linked tasks belong to that project; All Projects continues to show existing cross-project task references within the active workspace.
- Project-scope labels are translated across the app’s supported languages.
- Added `tests/project-scope.test.ts` for default/stale selection, widget data consistency, and table filters.

### Phase 3 acceptance results

- All Projects is the default, and selected project filters dashboard widgets and project tables: **implemented and unit checked**.
- Invalid/deleted selected project falls back to All Projects: **implemented and unit checked**.
- Task and milestone links remain inside active workspace collections; project-scoped dependencies require both tasks in the selected project: **implemented and unit checked**.
- Active workspace boundaries remain enforced by Phase 1 record-envelope queries; database/RLS staging verification is still required.
- `npm run typecheck` and focused ESLint for the changed project files: **passed**.
- `npx vitest run tests/project-scope.test.ts tests/workspace-scope.test.ts tests/bookkeeping-business-scope.test.ts tests/i18n-coverage.test.ts`: **passed, 18 tests**.
- `npm run build`: **passed**.

### Release gate

Phase 3 does not close the Phase 1 staging gate. Apply and validate `0008_workspace_foundation.sql` in staging, test cross-account/workspace scope, then perform interactive desktop/mobile verification before deployment.

## Phase 4 — Multi-plan content management

**Status:** Implemented locally and focused unit/type/build checked. Interactive browser QA, sync persistence against a staged workspace database, and real account verification remain.

### Implementation

- Added separate workspace-scoped record types for brands, content plans, channel accounts, and publication destinations. Existing campaigns remain separate; an existing campaign can be used by content in multiple plans.
- Extended canonical content posts with optional `planId` and category fields. Existing content without a plan stays visible under All Content and is never automatically assigned.
- Added destination records that link a canonical content item to a specific channel account. One source item can target several accounts, including multiple accounts on the same platform; each destination holds its own status, dates, URL, notes, and metrics.
- Added All Content / plan / channel scope controls. Scope filters content records, publications, plans, campaigns, chart data, KPIs, and account tables as applicable. Missing/deleted plan or channel selection falls back to All Content.
- Added CRUD tables for content plans, brands, channel accounts, and publications. Plans can be archived/restored; existing posts and destinations remain preserved when a plan is archived or removed.
- Added workspace-scoped plan/account names to the AI context builder. No publishing integrations or automatic approval changes were introduced; publication status remains user-managed.
- Added translations for the new controls and content entities across Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic.
- Added `tests/content-scope.test.ts` for default/stale selection, plan and account filters, scope-aware publication form choices, multiple same-platform accounts, and shared-source cross-post behavior.

### Phase 4 acceptance results

- All Content is the default and legacy content remains visible: **implemented and unit checked**.
- Plan/account selection scopes relevant tables, chart statuses, and KPIs: **implemented and unit checked**.
- Multiple channel accounts on the same platform are separate entities; a publication destination links to one shared source item: **implemented and unit checked**.
- Destination-level status, schedule, URL, notes, reach, and engagement are independent: **implemented**.
- Campaigns remain distinct and can be referenced by content in multiple plans; brand and plan are separate: **implemented**.
- New content creation requires a plan selection; existing unassigned posts stay unassigned until a user explicitly chooses a plan during edit: **implemented**.
- No SQL migration is needed for this vertical slice: records use the existing workspace-scoped local-first JSON sync collections. No production data was altered.
- `npm run typecheck`, focused ESLint, targeted tests including i18n coverage (**23 tests**), and `npm run build`: **passed**.

### Release gate

Phase 4 does not close the Phase 1 staging gate. Validate workspace-scoped sync and owner/RLS authorization on a staging clone, then check content and publication changes across two workspaces and offline reconnect before release.

## Phase 5 — Remaining multi-business tools

**Status:** Implemented locally and type/test/build checked. Staging sync, cross-workspace authorization, and interactive desktop/mobile QA remain unverified.

### Implementation

- Reused the Phase 2 Bookkeeping `Business` collection and added optional `businessId` ownership to inventory products/movements, sales/targets, invoices/payments, and cash scenarios/forecast items. Existing unassigned records remain available in All Businesses and are not auto-assigned.
- Added a shared business selector and Add Business flow to Inventory, Sales, Invoicing, and Cash Flow. Selected business scopes the tool’s forms, tables, dashboard calculations, and charts; All Businesses shows separate business cards and currency lanes instead of summing incompatible currencies.
- Validated product, contact, invoice, and forecast scenario references against their business when creating or editing records. Legacy parent references can be retained unchanged while the record remains explicitly unassigned.
- Added an Invoices ledger with per-business invoice numbering, first-line entry/edit support, dynamic payment-derived status/balance, and same-business customer/payment references.
- Added independent scenario selection for Cash Flow. The screen no longer chooses the first scenario by array position; forecast items require a scenario and business, and calculations/chart/KPIs read the selected scenario only. All Forecasts renders per-business/per-scenario summaries separately.
- Updated AI sale and invoice actions to assign to the single available business or ask for an explicit business when multiple choices exist. AI forecast queries report each scenario independently using its business currency.
- Added localized scope and invoice labels/messages for Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic.
- Added `tests/business-tool-scope.test.ts` for default/stale selection, scoped child history, and same-business reference validation.

### Phase 5 acceptance results

- Inventory, Sales, Invoicing, and Cash Flow use the shared Business identity: **implemented**.
- Selected business filters records and related forms; All Businesses preserves legacy visibility and keeps summaries separated by business/currency: **implemented and unit checked**.
- Cross-business product/contact/invoice/scenario links are rejected by form preparation: **implemented and unit checked**.
- Cash-flow scenarios no longer depend on collection order; forecast items are independently scoped and calculations use an explicit scenario: **implemented**.
- Invoices are manageable with per-business numbering and payment-derived status; AI sale/invoice actions require a safe business context: **implemented**.
- `npm run typecheck`, focused ESLint, targeted scope/i18n/inventory calculation tests (**101 tests**), `git diff --check`, and `npm run build`: **passed**.
- Live sync persistence, real multi-account isolation, offline/reconnect, and interactive responsive UI verification: **not verified**.

### Release gate

Phase 5 does not close the Phase 1 staging gate. Validate migration `0008_workspace_foundation.sql`, sync ownership/RLS, multi-workspace data separation, and offline/reconnect behavior on a staging clone before deployment.

## Phase 6 — Multi-property management

**Status:** Implemented locally and type/test/build checked. Staging sync and interactive desktop/mobile QA remain.

### Implementation

- Reused existing Property IDs and `propertyId` links for units, bookings, expenses, and maintenance. Added no replacement property model or database migration.
- Added horizontally scrollable All Properties / individual property tabs. All Properties is selected by default on refresh and when returning to Property Management; stale or archived selections fall back safely to All Properties.
- Applied one property scope to the dashboard, KPI calculations, booking revenue chart, child tables, and property form choices.
- Added portfolio counts for properties, units, current occupied/vacant units, upcoming bookings, and open maintenance. Revenue, expenses, net income, revenue by property, and occupancy by property are grouped by property currency and the same year-to-date accounting period; incompatible currencies are never combined.
- Added property archive confirmation and an archived-properties restore flow. Archiving retains linked history in the workspace record store; this store exposes soft-delete/archive rather than permanent record deletion.
- Added optional `businessId` association for properties in business context. Personal properties remain unassigned, and invalid business links are cleared on save.
- Added translations for the new property navigation, portfolio, and lifecycle labels across Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic.
- Added `tests/property-scope.test.ts` for default/stale selection, child collection filtering, and composition with existing table filters.

### Phase 6 acceptance results

- All Properties is the default and all selected-property dashboard/table data stays synchronized: **implemented and unit checked**.
- Portfolio overview reports counts, current unit occupancy, upcoming bookings, maintenance attention, and per-currency/year totals with property revenue and occupancy comparisons: **implemented**.
- Property business association is optional; personal properties are not forced into a business: **implemented**.
- Archive and restore preserve linked records; permanent hard deletion is not exposed by the existing offline-first record store: **implemented as safe archive lifecycle**.
- `npm run typecheck`, focused ESLint, scope/calculation/workspace/i18n tests (**87 tests**), and `npm run build`: **passed**.
- Live sync persistence, RLS/workspace isolation in staging, and interactive responsive QA: **not verified**.

### Release gate

Phase 6 does not close the Phase 1 staging gate. Validate `0008_workspace_foundation.sql`, workspace ownership/RLS, property records and links across two workspaces, and offline/reconnect behavior on a staging clone before deployment.

## Phase 7 — Other independent contexts

**Status:** Implemented locally and focused unit/type/build checked. Wedding migration assignment, live sync, staging isolation, and interactive responsive QA remain unverified.

### Implementation

- Added an explicit Wedding parent record flow and All Weddings / individual wedding selection. All Weddings is the default and stale or archived event IDs resolve safely to All Weddings.
- Added optional `weddingId` relationships to guests, vendors, budget lines, payments, tables, and tasks. Selected-event scope filters all six collections and the dashboard. All Weddings groups its overview totals by event currency instead of adding unlike currencies.
- Kept pre-existing records without a `weddingId` visible in All Weddings. Added an explicit, confirmation-based legacy assignment action that preserves IDs and fields; no records were automatically moved. Child record forms validate selected events and same-event vendor/table references.
- Added event context to child tables so multi-event views identify which wedding each row belongs to.
- Changed Savings Goals to open on an aggregate All Goals view rather than choosing the first goal by array position. Goal-specific details remain available after explicit selection; aggregate values follow the current tool currency.
- Audited budget, paycheck, debt, net-worth, nutrition, and habit relationships. Existing budgets remain category allocations; paycheck allocations and debt repayment settings retain their established parent links; Net Worth remains currency-grouped; nutrition and habits continue to use active workspace scope. No duplicate plan entities or additional relationship migrations were introduced.
- Added translations for the All Goals and Wedding scope/forms across Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic.
- Added `tests/wedding-scope.test.ts` for default/stale selection, all child collections, composable table filters, and legacy record preservation.

### Phase 7 acceptance results

- Wedding event selection defaults to All Weddings and scopes charts/tables/forms by event: **implemented and unit checked**.
- Legacy rows remain unassigned until explicit user choice; same-event guest table and vendor payment references are enforced: **implemented**.
- Multi-currency wedding portfolio totals remain separated: **implemented**.
- Savings Goals opens with All Goals and can still select individual goals: **implemented**.
- Existing financial and personal tool relationships reused without creating duplicate planning models: **audited; no extra schema introduced**.
- `npm run typecheck`, focused scope/calculation/i18n tests (**100 tests**), `git diff --check`, focused ESLint (no errors; one existing unused-variable warning in `life.tsx`), and `npm run build`: **passed**.
- Staging sync/authorization, migration rehearsal, real account reconciliation, and interactive mobile/desktop QA: **not verified**.

### Release gate

Phase 7 does not close the Phase 1 staging gate. Test wedding legacy assignment and event separation alongside workspace ownership/RLS, scoped sync, two-account isolation, and offline/reconnect behavior against a staging clone before any production migration or deployment.

## Phase 8 — Cross-tool integration and reporting

**Status:** Safe source integrations implemented locally and unit/type/build checked. Staging sync, actual offline browser retries, and cross-tool UI QA remain unverified.

### Implementation

- Added explicit, source-linked Bookkeeping mirrors for paid standalone Sales, issued Invoice Payments, paid inventory receipts, and completed paid rental stays from business-linked Properties. Each integration keeps its original source record canonical and requires the source and business to exist in the active workspace. Rental properties and businesses must also use the same currency.
- Stable mirror UUIDs include the active workspace and owner, and source type/ID tuples make retries idempotent. Repeated link actions update the one mirror rather than creating a second financial transaction. Source records retain a backlink; mirrored Bookkeeping records show a localized source label and cannot be edited/deleted there.
- Avoided duplicate sales revenue by refusing to mirror a Sale linked to an Invoice; the corresponding Invoice Payments are the canonical source instead. Invoice payments must reference an issued invoice from the same business and currency.
- Inventory receipts can only create expense mirrors after the user explicitly marks the receipt as paid from business funds. Paid rental stays use net proceeds after platform fees. Unlinking archives only the mirror and clears the source backlink; relinking can recreate it from the preserved source.
- Added source panels to the Sales, Invoice Payments, Inventory movements, and Property bookings tabs, with a confirmation dialog for unlink. Added Spanish, Simplified Chinese, Brazilian Portuguese, French, Russian, and Arabic translations for the new UI and validation messages.
- Added `tests/bookkeeping-integration.test.ts` for retry idempotency, invoice double-count protection, currency validation, explicit inventory payment marking, and paid business rental income.

### Deliberate non-integrations

- Cash Flow forecast items remain scenario projections, not actual receipts/payments; automatically copying posted transactions into them would mix actuals with forecasts and risk double counting.
- Business budgets are category targets without cash timing, so they are not duplicated into forecast items. Projects currently have no canonical expense ledger, and Content plans have no spend model. No links are inferred from matching labels or amounts.
- Property expenses and maintenance costs have no paid-status field; they are not mirrored as cash expenses. Rental income is linked only for a paid, completed stay on a property explicitly associated with the same business.

### Phase 8 acceptance results

- Cross-tool ownership and same-business/currency checks: **implemented and unit checked**.
- Duplicate financial entries prevented through deterministic IDs and source tuple lookup: **implemented and retry tested**.
- Source records remain canonical; mirror updates and archive/unlink behavior preserve corrective paths: **implemented**.
- `npm run typecheck`, focused ESLint, targeted business/property/integration/i18n tests (**19 tests**), and `git diff --check`: **passed**. The existing unused `foods` warning in `lib/tools/life.tsx` remains.
- `npm run build`: **passed**.
- Staging scoped-sync/RLS validation, browser offline/reconnect retry, reconciliation against real source data, and interactive responsive QA: **not verified**.

### Release gate

Completing local Phase 8 does not close the Phase 1 staging gate. The user reports applying migration `0008_workspace_foundation.sql`, and schema presence is confirmed in the currently configured project. Identify that project as staging or production, verify migration history and backfill, test owner/RLS and same-workspace source links across multiple workspaces, exercise interrupted/offline mirror retries, and reconcile source-to-mirror totals before considering rollout complete.
