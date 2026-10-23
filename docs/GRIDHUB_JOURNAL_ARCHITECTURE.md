# GridHub Journal architecture

GridHub Journal adds a server-rendered public reading surface and an administrator-only editorial CMS. It uses the existing Supabase service-role helper and server-side admin allowlist. Draft content, keywords, metrics, sources, reviews, jobs, and revisions are private in Postgres. Public data access is performed on the server and filtered to non-archived articles with a published revision whose publication time has arrived.

Article metadata and revisions are separate. `current_revision_id` is the editor's working revision, `approved_revision_id` identifies the human-approved revision, and `published_revision_id` is the revision readers receive. A new body revision clears approval while the previous published revision remains live. Scheduled publishing checks that the schedule revision still equals the approved revision before publishing.

Run `supabase db push` to apply `0004_gridhub_journal.sql`. Do not enable direct anonymous or authenticated table access; the migration enables RLS and grants the server service role. Admin API routes independently verify the signed-in user's server-verified email using the existing allowlist.

Public paths are `/journal`, `/journal/[category]`, and `/journal/[article-slug]`. Admin paths live under `/admin/journal`; the existing `/admin` layout protects them. Sitemap generation reads published article revisions from Supabase and excludes drafts and archived articles.

Current implementation intentionally uses CSV keyword imports and a manual Markdown editor. No remote search provider or unattended writing model is configured. The provider interfaces in `lib/journal` are extension points, not claims that an integration is active.
