# Overview widget customization

The Overview's Customize control opens a right-side panel on wide desktop displays and a safe-area-aware bottom sheet at narrower sizes. Both views use the existing widget registry and `UserPreferences.pinnedCharts` preference.

The catalog filters to activated tools and supports title/source search, Money/Business/Life/Work filters, add/remove, and restoring a recommended layout. Changes use the existing `setPrefs` persistence and sync path; success and failure are reported with toasts. Widget IDs are unchanged, and adding a widget never creates or deletes records.

Per-widget half/full width is stored in `UserPreferences.pinnedChartSizes`. Reordering remains available through the existing keyboard-operable move buttons on each widget. KPI choices have their own `UserPreferences.dashboardKpis` order and are edited in the same panel.
