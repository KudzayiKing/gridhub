# Debt payment calendar

The calendar supports month, week, and agenda views. Monthly occurrences require a due day or a next due date. Biweekly occurrences require a next due date and repeat every 14 days. Monthly day 29–31 dates clamp to the final day of shorter months, including leap February. Dates are generated in local calendar time.

Statuses are derived as follows: an explicit skipped record is `skipped`; recorded payments at least equal to the minimum are `paid`; a smaller positive amount is `partial`; an explicit plan is `planned`; otherwise past dates are `overdue`, dates within three days are `due soon`, and later dates are `upcoming`. The tracker never marks a payment paid based only on its due date.

Reminder lead times (7, 3, 1, or 0 days) are stored per debt and displayed in the tracker while it is open. Browser push and email delivery are not implemented. No reminders are sent while the app is closed.
