# Journal SEO and publishing

Published articles use a canonical URL, SEO title and description, semantic article layout, publication and update dates, an Article JSON-LD object, and a published-only sitemap entry. Category URLs are `/journal/money`, `/journal/business`, `/journal/life`, and `/journal/work`. Admin paths are disallowed in `robots.txt` and inherit no-index metadata from the protected admin layout.

Public pages are server-rendered from the approved published revision. Search and category listings only select rows with a published revision, an arrived publication timestamp, and non-archived status. Article HTML is not trusted or injected; the reader renders a bounded Markdown subset using React nodes.

Featured images currently use an editor-entered URL and alt text. GridHub Storage upload, image transformations, source-rights verification, automatic broken-link scanning, and automatic image licensing checks are not configured. Do not hotlink images without permission.

Article structured data identifies GridHub Editorial (or the explicitly entered author name); no credentials, ratings, or testimonials are fabricated. The sitemap reads current database rows and does not include drafts or future scheduled pages.
