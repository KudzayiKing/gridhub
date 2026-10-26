# Life dashboard enhancements

Wedding Planner, Rental Property Manager, and Nutrition Tracker now show a left-side signature visualization beside a right-side KPI card. They use saved records and existing calculation functions.

- Wedding metrics use recorded expenses, RSVP states, vendor payments, and planning tasks. Budget allocation uses committed amounts.
- Rental metrics use non-cancelled bookings, logged operating expenses, and maintenance. Mortgage principal is not reclassified as an operating expense.
- Nutrition totals use saved food log entries. The macro donut converts logged grams to calorie contribution using 4/4/9 kcal-per-gram factors; no daily target or food nutrition is invented.

Existing wedding, booking, and nutrition workflows remain available below the summary.

Limitations: occupancy is a year-to-date calculation using elapsed calendar days multiplied by active properties; bookings crossing the year boundary are assigned by check-in date in the existing selector. The dashboard does not add a shared month/week calendar, verified property financing detail, or nutrition targets.
