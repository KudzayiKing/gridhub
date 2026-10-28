-- Journal social drafts are editorial records, never customer workspace content.
-- Publishing integrations are intentionally not represented until credentials exist.
create table if not exists public.journal_social_posts (
  id uuid primary key default gen_random_uuid(),
  source_article_id uuid not null references public.journal_articles(id) on delete cascade,
  source_article_revision_id uuid not null references public.journal_article_revisions(id),
  platform text not null check (platform in ('linkedin','x','instagram','youtube_shorts')),
  format text not null,
  status text not null default 'draft' check (status in ('draft','needs_review','needs_revision','approved','scheduled','published_manual','failed','canceled')),
  current_revision_id uuid,
  approved_revision_id uuid,
  scheduled_at timestamptz,
  published_at timestamptz,
  publication_mode text check (publication_mode in ('manual','api')),
  external_publication_id text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_article_id, source_article_revision_id, platform),
  unique (id, current_revision_id),
  unique (id, approved_revision_id),
  foreign key (source_article_id, source_article_revision_id)
    references public.journal_article_revisions(article_id, id),
  check ((status = 'scheduled' and scheduled_at is not null) or status <> 'scheduled'),
  check ((status = 'published_manual' and publication_mode = 'manual' and published_at is not null) or status <> 'published_manual')
);

create table if not exists public.journal_social_post_revisions (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references public.journal_social_posts(id) on delete cascade,
  revision_number integer not null,
  title text not null default '',
  body text not null default '',
  cta_url text not null default '',
  creative_brief jsonb not null default '{}',
  change_note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (social_post_id, revision_number),
  unique (social_post_id, id)
);

alter table public.journal_social_posts
  add constraint journal_social_current_revision_fk foreign key (id, current_revision_id)
  references public.journal_social_post_revisions(social_post_id, id) deferrable initially deferred;
alter table public.journal_social_posts
  add constraint journal_social_approved_revision_fk foreign key (id, approved_revision_id)
  references public.journal_social_post_revisions(social_post_id, id) deferrable initially deferred;

create table if not exists public.journal_social_approvals (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references public.journal_social_posts(id) on delete cascade,
  revision_id uuid not null,
  reviewer_id uuid,
  decision text not null check (decision in ('approved','needs_revision')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  foreign key (social_post_id, revision_id)
    references public.journal_social_post_revisions(social_post_id, id) on delete cascade
);

create index if not exists journal_social_posts_queue_idx on public.journal_social_posts (status, scheduled_at, updated_at desc);
create index if not exists journal_social_posts_article_idx on public.journal_social_posts (source_article_id, source_article_revision_id);
create index if not exists journal_social_revisions_post_idx on public.journal_social_post_revisions (social_post_id, revision_number desc);
create index if not exists journal_social_approvals_post_idx on public.journal_social_approvals (social_post_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['journal_social_posts','journal_social_post_revisions','journal_social_approvals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
