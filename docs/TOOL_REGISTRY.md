# Tool registry

`lib/catalog.ts` is the single source of truth for what Gridhub is. Marketing pages,
navigation, onboarding, the dashboard, the route resolver and the operator view all read
from it. Adding a tool in one place makes it appear everywhere.

## `ToolDef`

```ts
interface ToolDef {
  id: ToolId;              // "budget" — stable key, used in storage and URLs
  slug: string;            // "budget" — marketing URL segment
  name: string;            // "Budget Planner"
  shortName: string;       // "Budget" — nav and mobile
  collection: CollectionId;// "money" | "business" | "life" | "work"
  tagline: string;         // one line, used on cards
  description: string;     // two sentences, used on the detail page
  icon: string;            // logical icon key, resolved by the icon registry
  benefits: string[];      // why it exists
  features: string[];      // what it does
  route: string;           // "/app/money/budget" — matched verbatim by the router
  freeTier?: boolean;      // part of the free plan
  order: number;           // display order within its collection
  keywords: string[];      // search terms for catalog search
}
```

`ToolId` is a union of the sixteen literal ids. A new tool that is not added to the union is a
compile error at every switch statement that handles tools — which is the point.

## Collections

| id | Label | Accent | Tools |
| --- | --- | --- | --- |
| `money` | Money | sage | budget, paycheck, debt, savings, net-worth |
| `business` | Business | slate | bookkeeping, inventory, sales, invoicing, cash-flow |
| `life` | Life | mist | wedding, property, nutrition |
| `work` | Work | ink | projects, habits, content |

Accents are used for the collection label and tool icon tint. They are not a full palette per
collection — that would fight the brand.

## Routing

There is one dynamic route, `app/app/[...slug]/page.tsx`. It joins the catch-all segments,
prefixes `/`, and looks for a tool whose `route` matches exactly:

```ts
const path = "/" + params.slug.join("/");
const tool = TOOLS.find((t) => t.route === path);
if (!tool) notFound();
```

`generateStaticParams()` emits all sixteen routes. An unknown path is a 404 — there is no
"render something for any tool id" fallback, because a typo'd URL should look like a typo,
not like an empty tool.

Marketing routes are separate and static: `/tools/[slug]` uses `toolBySlug()`, also with
`notFound()` for anything not in the catalog.

## How a tool is composed

```
lib/catalog.ts          identity, route, copy
        │
lib/tools/index.ts      buildTabs(toolId, data) → LedgerTab[]
        │
lib/tools/<domain>.ts   per-tool tab definitions (fields + columns)
        │
components/tools/tool-view.tsx
        ├── computeMetrics(toolId, data, currency) → metric strip
        ├── per-tool overview panel (optional)
        └── <LedgerTool tabs={...}>
                └── <TabPanel> → <DataTable> + <RecordForm>
```

`defineTab<T>()` is the type bridge:

```ts
defineTab<MoneyTransaction>({
  id: "transactions",
  collection: "transactions",
  fields: [...],
  columns: [{ key: "amount", header: "Amount", render: (r) => formatMoney(r.amount) }],
});
```

The render function sees `MoneyTransaction`, not `BaseRecord`. Inside the shared engine the
columns are erased to `BaseRecord`, which is the price of one table engine instead of sixteen.
The cast is contained in `defineTab` and nowhere else.

## Adding a tool

1. Add the id to `ToolId` in `lib/catalog.ts`.
2. Add the `ToolDef` to `TOOLS` with a unique `route`.
3. Add the icon key to `TOOL_ICON` in `components/icons/tool-icons.tsx` — TypeScript will
   refuse to compile without it.
4. Add the record interfaces to `lib/types.ts`.
5. Add pure calculation functions to `lib/calc/<domain>.ts`.
6. Add tab definitions to `lib/tools/<domain>.ts` and a case to `buildTabs`.
7. Add a `computeMetrics` case in `components/tools/tool-view.tsx`.
8. Add the tables to `supabase/migrations` and to the RLS loop array.
9. Add tests to `tests/calculations.test.ts`.
10. Add the tool to the `tool_catalog` seed.

Steps 1–3 are enforced by the compiler. Steps 8–9 are not, which is why they are listed here
and checked in the release checklist.

## Data access

`useToolData(toolId)` loads every record for a tool via `listAll(toolId)` and groups it by
collection name. Collections are plain strings (`"transactions"`, `"accounts"`), scoped by
`toolId` in the Dexie index `[toolId+collection]`.

That scoping is deliberate: `budget` and `bookkeeping` both have a `transactions` collection,
and they must not see each other's rows.

## Free tier

`freeTier` marks the one tool available on the free plan. It is read by `plansCovering` and
onboarding; it is not enforced client-side (see `BILLING_ENTITLEMENTS.md`, "What is not
enforced yet").
