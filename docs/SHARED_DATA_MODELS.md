# Shared data models

Every record in Gridhub follows the same envelope, whether it is a wedding guest or an
inventory movement. One envelope means one repository, one sync engine, one table, one form.

## `BaseRecord`

```ts
interface BaseRecord {
  id: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  deleted?: boolean;   // soft delete
  version?: number;    // optimistic concurrency
}
```

Domain interfaces extend it:

```ts
interface MoneyTransaction extends BaseRecord {
  accountId: string;
  categoryId?: string;
  date: string;              // YYYY-MM-DD
  description: string;
  amount: number;            // positive magnitude
  currency: string;
  type: "income" | "expense" | "transfer" | "savings";
  status: "posted" | "pending";
  notes?: string;
}
```

## Conventions

| Concern | Rule | Why |
| --- | --- | --- |
| Dates | `YYYY-MM-DD` strings for calendar dates; ISO 8601 for instants | A `Date` object does not survive JSON or IndexedDB round-trips predictably |
| Money | `number`, positive magnitude, direction in a separate field | Removes "did I negate this already?" bugs |
| Currency | Explicit on every monetary record | A record with no currency is a record you cannot format |
| Ids | `uid(prefix)` — e.g. `txn_...`, `mut_...` | Readable in logs, no collision risk |
| Soft delete | `deleted: true`, never a physical delete | Sync must be able to propagate a deletion |
| Version | Integer, incremented on every write | The server uses it to reject stale writes |
| Optional fields | `?` and `undefined`, never `null` | One empty representation, not two |

### Why amounts are magnitudes

Two representations are possible for an expense of $40:

```
amount: -40            // signed
amount: 40, type: "expense"   // magnitude + direction
```

Gridhub uses the second. With signed amounts, every consumer has to know the convention,
and one function that forgets to negate produces a report where expenses increase your
income. With a magnitude and a type, the direction is stated once, and `check (amount >= 0)`
in Postgres makes the invalid state unrepresentable.

### Why dates are strings

`new Date()` serialises to a string, deserialises to a string in some paths and a `Date` in
others, and shifts by a day for anyone east of UTC when you do date arithmetic on a
midnight timestamp. Storing `2026-10-21` and comparing lexicographically is boring and
correct.

`nightsBetween()`, `daysBetween()` and `isOverdue()` all operate on calendar dates, not on
milliseconds.

## `LocalRecord` — the storage row

The Dexie `records` table stores an envelope, not the domain object directly:

```ts
interface LocalRecord {
  id: string;
  toolId: string;            // "budget"
  collection: string;        // "transactions"
  data: Record<string, unknown>;  // the domain object
  createdAt: string;
  updatedAt: string;
  deleted: 0 | 1;            // IndexedDB-friendly
  version: number;
  dirty: 0 | 1;              // 1 = has un-synced changes
}
```

Why wrap rather than store the object flat:

- The index `[toolId+collection]` lets one query fetch exactly one tool's one collection.
  `budget.transactions` and `bookkeeping.transactions` never mix.
- `dirty` is a storage concern, not a domain concern. A `MoneyTransaction` should not have to
  know it is unsynced.
- `deleted` is numeric because IndexedDB indexes booleans poorly.

## `OutboxEntry`

```ts
interface OutboxEntry {
  id: string;              // client mutation id — the idempotency key
  toolId: string;
  collection: string;
  recordId: string;
  op: "upsert" | "delete";
  payload: string;         // JSON of the record
  createdAt: string;
  attempts: number;
  lastError?: string;
}
```

The outbox is written in the **same transaction** as the record. Either both land or neither
does — there is no window where a record exists locally with no intention to sync it.

`id` is generated on the client and sent to the server, which records it in
`sync_mutations`. A retry that arrives twice is applied once.

## Cross-collection references

Records reference each other by id, not by nesting:

```
MoneyTransaction.accountId ──► MoneyAccount.id
Invoice.payments[]          ──► Payment.id
Task.projectId              ──► Project.id
```

Consequences:

- Calculations join in memory over arrays already loaded. At personal scale (thousands of
  rows, not millions) this is faster than a round trip and works offline.
- A dangling reference is possible. Every consumer must handle "referenced row not found" —
  typically by rendering the raw id rather than crashing. This is why `rows()` lookups are
  optional-returning.
- Deleting a parent does not cascade locally. The UI warns when a parent with children is
  removed; the database cascades on the server.

## Preference record

```ts
interface UserPreferences {
  currency: string;        // "USD"
  locale: string;          // "en-US"
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  timeZone: string;        // "Africa/Lagos"
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
  businessName?: string;
}
```

Formatting reads from preferences, not from the browser locale. A user in Lagos who prefers
`en-GB` and NGN should not see `$1,234.56` because their laptop is set to `en-US`.

## What is deliberately not modelled

- **Attachments.** No file storage, no receipts. Adding it means object storage, signed URLs
  and a retention policy — a product decision, not a schema gap.
- **Multi-currency conversion.** Records carry a currency; there is no FX table and no
  conversion. Totals are grouped, never converted, because a stale rate is worse than no total.
- **Recurring transaction generation.** Bills are modelled; nothing materialises future
  transactions automatically.
- **Audit history per record.** `record_versions` exists on the server; the client does not
  expose a history UI.
