# Dashboard calculation and QA notes

Dashboards call the existing pure calculation functions for bookkeeping, inventory, sales, invoicing, cash forecasting, wedding planning, rentals, nutrition, habits, projects, and content. Presentation code groups those results; it does not create another financial source of truth.

Validation performed:

- npm run typecheck
- Targeted ESLint for operations-dashboard.tsx and tool-view.tsx

Targeted ESLint and type checking pass, and the production build completes. The full test suite has one unrelated existing failure in deterministic AI parsing: the phrase “add 40 for fuel” is parsed when the test expects no deterministic result; the other 180 tests pass. Full lint reports existing errors in AI, chart, PWA, and shared UI files outside the new dashboard components. Full integration, mobile visual QA, and offline synchronization remain to be checked.
