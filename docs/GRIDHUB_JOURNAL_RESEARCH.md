# Journal keyword research

The initial twelve seeded topics are candidates supplied by the product brief. They have no search volume, difficulty, or search-intent score. Their source is labeled `editorial topic seed — not researched`; they cannot be approved into briefs until a volume source, observation date, and GridHub category are supplied.

Use Admin → Journal → Research or Opportunities to import a CSV. At minimum include `keyword`, `category`, `monthly_search_volume`, `volume_source` (or `provider`), and `observed_at`. Optional columns include `country`, `language`, `search_intent`, `related_keywords`, `competition`, `difficulty_score`, `difficulty_source`, `cost_per_click`, `proposed_title`, `gridhub_tool`, `free_calculator`, `unique_value`, and explicit component scores (`relevance_score`, `intent_score`, `differentiation_score`). Duplicate normalized keywords are merged; identical source observations are deduplicated.

Search demand uses `min(100, 25 × log10(volume + 1))`. Feasibility uses `100 - difficulty` only when difficulty source is supplied. Missing evidence is omitted from the weighted average and reduces evidence coverage rather than counting as zero. Default weights are 30% relevance, 25% intent, 20% demand, 15% feasibility, and 10% differentiation; administrators can change them, with the sum constrained to 100%.

The current importer does not connect Google Search Console, Google Ads, Semrush, Ahrefs, or DataForSEO. Google Search Console OAuth and query sync require credentials, consented property access, and an authorized integration; Search Console data is not universal monthly volume. Search-volume provider labels and dates come from the imported data. Do not infer missing metrics.

Before making a brief, the system compares normalized keywords and title overlap against existing articles. Similar topics are flagged as `update_existing`. A brief remains private and contains validation questions; it is not article text or an approval.
