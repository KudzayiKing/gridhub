create table if not exists public.journal_article_translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.journal_articles(id) on delete cascade,
  revision_id uuid not null references public.journal_article_revisions(id) on delete cascade,
  language text not null check (language in ('es', 'zh-CN', 'pt-BR', 'fr', 'ar', 'ru')),
  translation jsonb not null,
  provider text not null default 'google-cloud-translation-v2',
  translated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (article_id, revision_id, language)
);

alter table public.journal_article_translations enable row level security;

-- Translations are read and written through the server using the service role. Public clients
-- must not be able to insert or alter cached article content.
