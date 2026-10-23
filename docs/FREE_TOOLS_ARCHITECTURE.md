# Free Tools architecture

Public routes live under `app/free-tools`. `lib/free-tool-catalog.ts` is the source for tool IDs, copy, destinations, and icon keys. `components/free-tools/calculator.tsx` owns the public directory and the browser-side calculator forms; `lib/free-tools.ts` owns pure calculation functions.

To add a calculator, add a catalog item, calculation function, typed calculator inputs/results, form/result branch, metadata title, sitemap coverage (catalog-driven), FAQs, and unit tests. Use registered `AnimatedIcon` names, design tokens, and the existing marketing shell. Keep calculations local and do not add authentication or Supabase calls to public calculator rendering.

Calculator CTAs store a versioned draft in same-tab sessionStorage with a 30-minute expiry, then navigate to the existing app route or through `/login?next=...`. No calculator values are added to the URL and no anonymous draft is sent to Supabase. The destination displays a draft notice with a link back to the calculator, which restores the inputs. Existing app record forms do not currently expose a common import contract; the handoff does not yet prefill destination forms or create records. Users must create and confirm any persistent record in the app.

No marketing analytics vendor is configured for this surface. Do not add one without following the site's consent and privacy model. Financial inputs must never be included in event payloads.
