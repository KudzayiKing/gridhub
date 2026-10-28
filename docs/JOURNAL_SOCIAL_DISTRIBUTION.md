# Journal Social Distribution

## Purpose and workflow

`/admin/journal/social` turns an approved or published immutable Journal article revision into editable drafts for LinkedIn, X, Instagram, and YouTube Shorts. The Journal article review does not approve a social draft. Every platform draft has its own revision history and must be submitted and approved independently.

1. Choose an approved or published article and channels.
2. Create the platform-specific draft pack.
3. Edit the copy and creative brief; saving creates a new immutable social revision.
4. Submit each platform draft for review, then approve it or request changes.
5. Copy the approved text and open the platform to publish manually. YouTube Shorts content is a script and shot list, not an uploaded video.

Drafts refer to the article revision that was used to create them. The initial implementation blocks duplicates for the same article revision and channel rather than silently replacing an existing post.

## Generation and quality

`lib/journal/social.ts` provides a deterministic, source-linked template adapter. It is not an AI provider and does not make a claim that an LLM generated or fact-checked the draft. Debt snowball/avalanche copy uses the article-specific definitions and avoids promised savings amounts. Other articles use their article title and excerpt as a conservative starting point for human editing. Character counts in the editor are informational; actual provider limits, URL treatment, and account permissions must be checked in the destination platform.

The existing Journal text-generation abstraction currently has no configured provider. No new paid model dependency or credential was introduced. Image/video generation is also not connected; creative briefs describe the asset and explicitly do not claim to create one.

## Review and records

Apply `supabase/migrations/0007_journal_social_distribution.sql`. The migration adds social post records, immutable copy revisions, and reviewer decisions. RLS is enabled and direct access by `anon` and `authenticated` is revoked; server routes require the existing Journal admin check and use the service-role client. Access tokens are not stored.

Changing copy after approval clears the approved revision and returns the post to draft. Scheduling requires approval of the current revision. In this release, scheduling stores a manual reminder (`publication_mode = manual`); there is no social queue or automatic publisher. A post becomes `published_manual` only after an admin explicitly marks it, and is labeled user-reported.

## Integrations and limitations

- LinkedIn, X, Meta/Instagram, and YouTube publishing providers are not configured.
- There is no social publishing scheduler, API publication status lookup, or idempotent platform retry path; therefore no automatic publishing is offered.
- No platform analytics connections exist. Impressions, clicks, engagement, views, and conversion metrics are not fabricated or shown as connected.
- Drafts remain in the Journal administrative database. They are not copied into the customer-owned Social Media Content Planner, avoiding exposure of editorial records to customer workspaces and avoiding a second source of truth.
- The existing article URL is included in social copy. UTM parameters are not currently added because the application has no connected social attribution pipeline or consent-aware campaign configuration for these draft links.

## Operations

After applying the migration, open `/admin/journal/social`. If the new tables are missing, the page reports that migration `0007_journal_social_distribution.sql` must be applied. Publishing a copied draft, uploading creative assets, and marking manual publication are separate operator actions.
