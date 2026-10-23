# Journal automation and integrations

`JOURNAL_CRON_SECRET` enables the authenticated scheduled-publication endpoint only. This repository does not define a Vercel, Supabase, or GitHub Actions cron schedule. Configure the hosting cron explicitly and inspect `/admin/journal/jobs` before treating scheduled publishing as active.

No weekly keyword-research job is created because no Search Console OAuth or keyword metrics provider is configured. No AI writing job is available: interactive Codex is not exposed here as an unattended execution API, and no paid LLM is configured. The CMS provides a structured brief export and Markdown draft import/export instead.

Google Search Console read-only OAuth, Google Ads Keyword Planner, and third-party keyword providers remain unimplemented adapters requiring credentials, operator authorization, quota and cost policy, and provider terms review. Provider interfaces are defined in `lib/journal/keyword-providers.ts` and `lib/journal/content-generation.ts`; the configured-provider functions currently return `null`.

No automatic article publishing is performed by research or drafting operations. Retries use job records and scheduled publication checks the exact approved revision before changing public state.
