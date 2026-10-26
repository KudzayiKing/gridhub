# Shared chart components

The eleven Business, Life, and Work tools reuse the existing chart container, category donut, trend chart, and ranking chart components. Their common overview frame places the signature visualization at the left on desktop and groups KPIs into one card at the right; mobile stacks the panels.

Charts read local-first tool data supplied to ToolView, so saved offline edits update aggregates through the existing data subscription. Existing tables, forms, and tooltips are preserved. Donuts are used for meaningful status or category splits; Cash Flow uses projected cash balance as its hero chart.

The Overview widget registry now includes at least one summary or chart for each Business, Life, and Work tool. The new signature-chart pin buttons use the same widget registry definitions and offline-first collections as their parent tools. Existing range controls and calendar behavior remain tool-specific.
