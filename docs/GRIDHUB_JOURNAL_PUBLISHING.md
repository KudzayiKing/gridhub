# Journal publishing operations

Apply the Journal migration, set `SUPABASE_SERVICE_ROLE_KEY` server-side, then create/edit a draft at `/admin/journal/articles`. Save, add reliable sources, mark sources verified only after checking them, pass the quality gate, submit for human approval, complete the server-enforced checklist, and approve the current revision. Publish immediately or schedule an IANA-time-zone date in the editor; the saved timestamp is UTC.

The scheduled publishing endpoint is `POST /api/cron/journal/publish` with `Authorization: Bearer $JOURNAL_CRON_SECRET`. Configure your hosting scheduler to call it (for example, once each minute) and set a high-entropy secret only in server environment configuration. The route is disabled without the secret. A failed run can be retried; article state and the approved revision ID make publication idempotent. Runs and individual publication events are recorded for Admin inspection.

No hosting cron configuration exists in this repository, so scheduled publication will not run until the operator configures one. Weekly research automation is also not active: there is no Search Console OAuth or keyword provider. CSV imports remain available. Do not report a job as scheduled or running until an external scheduler is configured and successful job rows appear.

Content-only publication does not require an application rebuild after the schema is deployed. The sitemap is dynamic; deployment/CDN cache behavior should still be checked for the production host.
