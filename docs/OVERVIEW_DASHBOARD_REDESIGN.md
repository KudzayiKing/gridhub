# Overview dashboard redesign

The signed-in overview remains in `app/app/page.tsx`. It now prioritizes a compact summary, data-backed KPIs, pinned charts, attention items, recent activity, and a compact tool launcher. The public homepage and individual tool pages are unchanged.

The existing `CHART_WIDGETS` registry in `lib/chart-widgets.tsx` remains the source of widget IDs, source tools, descriptions, and renderers. Existing pin IDs and order are preserved. The first-time recommended layout is written only when dashboard preferences have finished loading and the user has no `pinnedCharts` preference.

Pinned charts appear directly below the KPI and attention summary. The first recommended chart uses full width; users can switch any chart between half and full width. Existing accessible move-up and move-down controls reorder pins.
