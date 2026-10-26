# Debt Tracker enhancements

The Debt Snowball & Avalanche Tracker now has Overview, Payment Calendar, Strategies, and Insights sections. It uses existing debt and payment collections, current shared payoff simulation, chart components, user preferences, and paycheck records.

## Records and migration

Debt due-date and lender fields (`lender`, `dueDay`, `nextDueDate`, `reminderDaysBefore`) and payment metadata (`status`, `paycheckId`, `notes`) are optional properties on the existing local-first JSON records. The app syncs these records through its generic collection storage; no Supabase table migration is required. Older records remain valid without the optional fields.

The calendar creates stable occurrence IDs from debt ID and date. It derives statuses from saved payment records and does not mark a payment paid when time passes. It does not silently change a lender's due date. Recurring minimums only appear when the user supplies a contractual due day or next due date. Planned extras retain their user-selected date.

Payment recording does not also reduce the stored debt balance. This avoids double subtraction; users should update the tracked balance from their lender statement. Planned paycheck assignments reserve funds but do not create a paid transaction.

## Scope limits

Reminders are in-app and appear when the user opens the tracker. Push and email delivery are not configured. No browser notification permission is requested. Scenario persistence, lender integrations, transaction linking, and automated balance reconciliation are not included.
