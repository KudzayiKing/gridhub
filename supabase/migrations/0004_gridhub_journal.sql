create extension if not exists "pgcrypto";

create table if not exists public.journal_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0
);

insert into public.journal_categories (slug, name, description, sort_order) values
  ('money', 'Money', 'Practical guidance for budgeting, debt, savings, and financial planning.', 1),
  ('business', 'Business', 'Useful systems for bookkeeping, inventory, sales, and small business operations.', 2),
  ('life', 'Life', 'Ideas for rental properties, wedding planning, nutrition, and everyday organization.', 3),
  ('work', 'Work', 'Guides to projects, habits, productivity, and content planning.', 4)
on conflict (slug) do nothing;

create table if not exists public.journal_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  category_id uuid not null references public.journal_categories(id),
  author_name text not null default 'GridHub Editorial',
  status text not null default 'draft' check (status in ('idea','researching','brief_ready','drafting','draft','quality_review','needs_revision','awaiting_approval','approved','scheduled','published','archived')),
  current_revision_id uuid,
  approved_revision_id uuid,
  published_revision_id uuid,
  publish_at timestamptz,
  published_at timestamptz,
  seo_title text not null default '',
  seo_description text not null default '',
  canonical_url text,
  primary_keyword text not null default '',
  secondary_keywords text[] not null default '{}',
  featured_image text,
  featured_image_alt text not null default '',
  related_calculator_slug text,
  related_tool_slug text,
  substantial_review_required boolean not null default true,
  quality_report jsonb not null default '[]',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  revision_number integer not null,
  body_markdown text not null default '',
  change_note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (article_id, revision_number),
  unique (article_id, id)
);

alter table public.journal_articles
  add constraint journal_current_revision_fk foreign key (id, current_revision_id) references public.journal_article_revisions(article_id, id) deferrable initially deferred;
alter table public.journal_articles
  add constraint journal_approved_revision_fk foreign key (id, approved_revision_id) references public.journal_article_revisions(article_id, id) deferrable initially deferred;
alter table public.journal_articles
  add constraint journal_published_revision_fk foreign key (id, published_revision_id) references public.journal_article_revisions(article_id, id) deferrable initially deferred;

create table if not exists public.journal_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);
create table if not exists public.journal_article_tags (
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  tag_id uuid not null references public.journal_tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

create table if not exists public.journal_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  normalized_keyword text not null unique,
  country text not null default 'US',
  language text not null default 'en',
  category_slug text check (category_slug in ('money','business','life','work')),
  search_intent text not null default 'unknown',
  related_keywords text[] not null default '{}',
  status text not null default 'new' check (status in ('new','reviewed','approved','rejected','needs_validation','briefed')),
  proposed_title text not null default '',
  gridhub_tool text,
  free_calculator text,
  unique_value text not null default '',
  source text not null default 'manual',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_keyword_metrics (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references public.journal_keywords(id) on delete cascade,
  monthly_search_volume integer,
  volume_source text not null default 'unverified',
  volume_observed_at timestamptz,
  volume_period text,
  competition text,
  difficulty_score numeric(6,2),
  difficulty_source text,
  cost_per_click numeric(12,4),
  metric_source text not null default 'manual',
  source_record_key text not null unique,
  raw_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (monthly_search_volume is null or monthly_search_volume >= 0),
  check (difficulty_score is null or difficulty_score between 0 and 100)
);

create table if not exists public.journal_keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references public.journal_keywords(id) on delete cascade,
  relevance_score numeric(6,2),
  intent_score numeric(6,2),
  demand_score numeric(6,2),
  feasibility_score numeric(6,2),
  differentiation_score numeric(6,2),
  total_score numeric(6,2),
  scoring_weights jsonb not null default '{"relevance":30,"intent":25,"demand":20,"feasibility":15,"differentiation":10}',
  cannibalization_report jsonb not null default '[]',
  status text not null default 'new' check (status in ('new','approved','rejected','update_existing')),
  proposed_angle text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (keyword_id)
);

create table if not exists public.journal_research_sources (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid references public.journal_keywords(id) on delete cascade,
  article_id uuid references public.journal_articles(id) on delete cascade,
  title text not null,
  url text not null,
  publisher text not null default '',
  published_at date,
  accessed_at timestamptz not null default now(),
  source_type text not null default 'web',
  notes text not null default '',
  verified boolean not null default false
);

create table if not exists public.journal_article_briefs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  keyword_id uuid references public.journal_keywords(id) on delete set null,
  brief jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  revision_id uuid not null references public.journal_article_revisions(id) on delete cascade,
  reviewer_id uuid,
  decision text not null check (decision in ('requested_revision','approved','rejected')),
  checklist jsonb not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.journal_publication_schedule (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  revision_id uuid not null references public.journal_article_revisions(id),
  publish_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','published','canceled','failed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (article_id, revision_id)
);

create table if not exists public.journal_publication_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  revision_id uuid not null references public.journal_article_revisions(id),
  event_type text not null check (event_type in ('published','unpublished','republished')),
  actor_id uuid,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.journal_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','canceled')),
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.journal_content_performance (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  observed_on date not null,
  impressions bigint,
  organic_clicks bigint,
  ctr numeric(8,6),
  average_position numeric(8,2),
  article_views bigint,
  cta_clicks bigint,
  signups bigint,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (article_id, observed_on, source)
);

create table if not exists public.journal_events (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  event_name text not null check (event_name in ('journal_article_viewed','journal_cta_clicked','journal_calculator_opened')),
  anonymous_session_id uuid not null,
  created_at timestamptz not null default now(),
  unique (article_id, event_name, anonymous_session_id)
);

create table if not exists public.journal_internal_links (
  id uuid primary key default gen_random_uuid(),
  source_article_id uuid not null references public.journal_articles(id) on delete cascade,
  target_article_id uuid references public.journal_articles(id) on delete cascade,
  target_path text not null,
  anchor_text text not null,
  status text not null default 'suggested' check (status in ('suggested','accepted','ignored')),
  created_at timestamptz not null default now()
);

create table if not exists public.journal_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.journal_settings (setting_key, setting_value) values
  ('opportunity_weights', '{"relevance":30,"intent":25,"demand":20,"feasibility":15,"differentiation":10}'::jsonb),
  ('editorial_timezone', '"UTC"'::jsonb),
  ('weekly_target', '3'::jsonb)
on conflict (setting_key) do nothing;

-- Prompt-supplied topic candidates are a research backlog only. No volumes,
-- intent scores, or difficulty values are assigned without source evidence.
with topic(keyword, category_slug, proposed_title, gridhub_tool, free_calculator) as (values
  ('debt snowball vs avalanche', 'money', 'Debt Snowball vs. Avalanche: How to Choose a Payoff Strategy', 'debt', 'debt-payoff-calculator'),
  ('how to calculate debt payoff time', 'money', 'How to Estimate Your Debt Payoff Timeline', 'debt', 'debt-payoff-calculator'),
  ('how extra payments affect debt interest', 'money', 'How Extra Debt Payments Can Change Interest and Timing', 'debt', 'debt-payoff-calculator'),
  ('how to create a monthly budget', 'money', 'How to Build a Monthly Budget You Can Maintain', 'budget', 'monthly-budget-calculator'),
  ('50/30/20 budgeting rule', 'money', 'The 50/30/20 Budget: How to Adapt the Guideline', 'budget', 'monthly-budget-calculator'),
  ('budgeting with irregular income', 'money', 'How to Budget When Your Income Changes Month to Month', 'paycheck', 'monthly-budget-calculator'),
  ('rental property cash flow', 'life', 'How to Estimate Rental Property Cash Flow', 'property', 'rental-property-calculator'),
  ('net operating income rental property', 'life', 'What Net Operating Income Means for a Rental Property', 'property', 'rental-property-calculator'),
  ('how to calculate monthly savings goal', 'money', 'How to Calculate Monthly Savings Contributions for a Goal', 'savings', 'savings-goal-calculator'),
  ('profit margin vs markup', 'business', 'Profit Margin vs. Markup: What Each Number Tells You', 'business', 'profit-margin-calculator'),
  ('how to calculate gross profit margin', 'business', 'How to Calculate Gross Profit Margin', 'business', 'profit-margin-calculator'),
  ('how to calculate invoice total', 'business', 'How to Calculate an Invoice Total with Discounts and Tax', 'invoicing', 'invoice-total-calculator')
), inserted as (
  insert into public.journal_keywords (keyword, normalized_keyword, category_slug, proposed_title, gridhub_tool, free_calculator, source, status)
  select keyword, keyword, category_slug, proposed_title, gridhub_tool, free_calculator, 'editorial topic seed — not researched', 'needs_validation' from topic
  on conflict (normalized_keyword) do nothing returning id
)
insert into public.journal_keyword_metrics (keyword_id, monthly_search_volume, volume_source, metric_source, source_record_key)
select id, null, 'unverified', 'unverified', md5('unverified-editorial-seed-' || id::text) from inserted;

insert into public.journal_keyword_opportunities (keyword_id, scoring_weights)
select id, '{"relevance":30,"intent":25,"demand":20,"feasibility":15,"differentiation":10}'::jsonb
from public.journal_keywords where source = 'editorial topic seed — not researched'
on conflict (keyword_id) do nothing;

create index if not exists journal_articles_public_idx on public.journal_articles (published_at desc) where published_revision_id is not null;
create index if not exists journal_articles_status_idx on public.journal_articles (status, publish_at);
create index if not exists journal_articles_category_idx on public.journal_articles (category_id, published_at desc);
create index if not exists journal_revisions_article_idx on public.journal_article_revisions (article_id, revision_number desc);
create index if not exists journal_metrics_keyword_idx on public.journal_keyword_metrics (keyword_id, volume_observed_at desc);
create index if not exists journal_opportunities_score_idx on public.journal_keyword_opportunities (total_score desc nulls last);
create index if not exists journal_sources_article_idx on public.journal_research_sources (article_id, accessed_at desc);
create index if not exists journal_schedule_due_idx on public.journal_publication_schedule (status, publish_at);

do $$ declare t text; begin
  foreach t in array array[
    'journal_categories','journal_articles','journal_article_revisions','journal_tags','journal_article_tags',
    'journal_keywords','journal_keyword_metrics','journal_keyword_opportunities','journal_research_sources',
    'journal_article_briefs','journal_editorial_reviews','journal_publication_schedule','journal_publication_events','journal_job_runs',
    'journal_content_performance','journal_events','journal_internal_links','journal_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
