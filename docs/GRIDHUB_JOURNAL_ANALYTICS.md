# Journal analytics and privacy

Journal page views, GridHub CTA clicks, and calculator opens are collected only after a visitor explicitly opts in. Event rows contain an article ID, one of three fixed event names, a random per-tab session UUID, and timestamp. Duplicate events per article/event/session are ignored. No user account, financial inputs, nutrition data, referrer, article body, or arbitrary event payload is stored.

Admin → Journal → Analytics displays observed events and any imported content-performance snapshots. Google Search Console impressions/clicks/CTR/position, signup completion, tool activation, and paid conversion attribution are not connected. Do not infer signups or paid conversions from CTA clicks.

The dashboard event deduplication is a coarse anonymous browser-session count, not a precise people count. Apply the Journal migration for event storage. Search Console OAuth and API quota handling require a separately authorized integration.
