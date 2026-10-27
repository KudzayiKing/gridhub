# Overview testing notes

Validation run for this change:

- `npm run typecheck` — passed.
- Targeted ESLint for `app/app/page.tsx`, `lib/chart-widgets.tsx`, `lib/use-dashboard.ts`, and `lib/i18n.ts` — passed without warnings after stabilizing the active-tool selector.
- `npm run build` — passed.
- `npm test` — 12 of 13 files and 180 of 181 tests passed. The existing `tests/ai-parsing.test.ts` expectation for `deterministicParse("add 40 for fuel")` fails because the parser currently routes it as a savings contribution. This is outside the Overview changes and remains unresolved.

Responsive browser interaction checks were not run in this environment. The mobile/desktop panel behavior is implemented with responsive CSS and the existing Radix dialog primitives; it should still be checked on a phone and desktop before launch.
