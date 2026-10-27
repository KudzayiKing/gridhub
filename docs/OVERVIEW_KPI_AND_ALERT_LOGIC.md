# Overview KPI and attention logic

The KPI set is capped at four and only includes activated tools with relevant records: budget activity, saved goals, existing tasks, invoices with an outstanding amount, scheduled habits, or content activity. KPI cards link to their source tool. Users can remove, add, and reorder eligible KPIs in Customize Dashboard. Values continue to come from `useDashboardData` and its established calculation services.

Attention items continue to come from the existing dashboard aggregation. The empty state is now compact and reads “You're all caught up.” This pass does not add new alert sources; those require additional source data and validation against each tool's rules.
