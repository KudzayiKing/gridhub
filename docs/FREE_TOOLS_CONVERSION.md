# Free Tools conversion and privacy

Each calculator CTA points at its corresponding existing application route and communicates whether access is free or plan-dependent. Unauthenticated visitors pass through `/login?next=<internal app path>`; the existing auth callback preserves that local return route.

When clicked, the browser writes a versioned, same-tab sessionStorage draft with a 30-minute expiry. Draft data is not placed in a URL or sent to the server. The destination shows a draft notice; returning to the calculator restores the values. Destination record forms do not yet import them. Do not auto-create persistent records from a CTA. A future import must validate the draft after login, show a review/prefill form, require explicit save confirmation, and clear or expire the handoff.

No third-party conversion analytics events are emitted by this feature because the repository has no configured marketing analytics/consent integration. If one is added, events may contain calculator ID and funnel stage only; never send input values, balances, prices, income, or invoice content.
