# Overview preferences and sync

Pinned widgets remain stored as `UserPreferences.pinnedCharts` and are written through the established preference store, preserving offline persistence and cross-device reconciliation. Existing selections and order are retained. `pinnedChartSizes` stores half/full width by widget ID; missing sizes use the recommended first-full/rest-half display without rewriting the user's saved pin list.

The recommended layout is seeded only for a loaded preference record where `pinnedCharts` is absent. An explicitly empty list is respected. Restore Defaults replaces the pin list with recommendations for currently activated tools.
