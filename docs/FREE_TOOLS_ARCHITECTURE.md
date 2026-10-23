# Free Tools architecture

Public routes live under `app/free-tools`. `lib/free-tool-catalog.ts` is the source for tool IDs, copy, destinations, and icon keys. `components/free-tools/calculator.tsx` owns the public directory and the browser-side calculator forms; `lib/free-tools.ts` owns pure calculation functions.

To add a calculator, add a catalog item, calculation function, typed calculator inputs/results, form/result branch, metadata title, sitemap coverage (catalog-driven), FAQs, and unit tests. Use registered `AnimatedIcon` names, design tokens, and the existing marketing shell. Keep calculations local and do not add authentication or Supabase calls to public calculator rendering.

Calculator CTAs store a versioned draft in same-tab sessionStorage with a 30-minute expiry, then navigate to the existing app route or through `/login?next=...`. No calculator values are added to the URL and no anonymous draft is sent to Supabase. The destination displays a review-and-import dialog and a link back to the calculator. No record is created until the user explicitly confirms. Monthly plans create categories, not transactions; invoice imports remain drafts; rental estimates and profit analysis are not represented as actual expenses, income, or payments.

Public calculator analytics are first-party and opt-in. Only the calculator ID and the `calculator_view` / `signup_click` event are sent, with a random session identifier used for aggregate unique-session counts. Calculator inputs, user identity, and referrer are not sent. The Marketing admin page requires the `0003_marketing_events.sql` migration.
