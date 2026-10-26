# Cross-tool financial integrity

Dashboard summaries use each tool's existing authoritative record type:

- Bookkeeping cash revenue and expenses come from business transactions.
- Sales revenue comes from sale records; invoice payments do not become separate sales.
- Invoice collections come from payments linked to invoices. Invoices issued are not cash receipts.
- Cash Flow remains a forecast of saved forecast items and does not automatically count invoices as collected.
- Inventory quantities come from product and movement records; stock reductions are not treated as sales.
- Rental revenue comes from non-cancelled bookings; operating costs come from fees, expenses, and maintenance.

No automatic cross-tool replication was added. Future synchronization needs stable source references, idempotency, and explicit confirmation to avoid duplicate money movements.
