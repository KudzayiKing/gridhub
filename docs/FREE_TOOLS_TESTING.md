# Free Tools testing

Run `npm test` to execute the unit suite, including `tests/free-tools.test.ts`, and `npm run typecheck` for TypeScript. Run `npm run build` to verify static route generation and metadata. Existing Playwright public-route smoke tests should also cover the `/free-tools` directory and each generated calculator page when the app is running.

The focused calculation tests cover budget totals and zero denominators, debt payoff and non-amortizing plans, rental NOI versus financing and zero-rate loans, savings targets with and without interest, margin versus markup, and invoice discount/tax/payment calculations. Manual QA should additionally inspect mobile widths, keyboard access, both themes, clipboard/print behavior, public access, canonical metadata, and the login return path.
