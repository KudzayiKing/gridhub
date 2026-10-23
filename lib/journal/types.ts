export const JOURNAL_STATUSES = ["idea", "researching", "brief_ready", "drafting", "draft", "quality_review", "needs_revision", "awaiting_approval", "approved", "scheduled", "published", "archived"] as const;
export type JournalStatus = typeof JOURNAL_STATUSES[number];

export interface JournalCategory { id: string; slug: string; name: string; description: string; sort_order: number }
export interface JournalRevision { id: string; article_id: string; revision_number: number; body_markdown: string; change_note: string; created_at: string }
export interface JournalArticle {
  id: string; slug: string; title: string; excerpt: string; category_id: string; author_name: string; status: JournalStatus;
  current_revision_id: string | null; approved_revision_id: string | null; published_revision_id: string | null;
  publish_at: string | null; published_at: string | null; seo_title: string; seo_description: string; canonical_url: string | null;
  primary_keyword: string; secondary_keywords: string[]; featured_image: string | null; featured_image_alt: string;
  related_calculator_slug: string | null; related_tool_slug: string | null; created_at: string; updated_at: string;
  category?: JournalCategory; revision?: JournalRevision;
}
export interface JournalKeyword { id: string; keyword: string; normalized_keyword: string; country: string; language: string; category_slug: string | null; search_intent: string; related_keywords: string[]; status: string; proposed_title: string; gridhub_tool: string | null; free_calculator: string | null; unique_value: string; source: string; created_at: string }
export interface KeywordMetric { monthly_search_volume: number | null; volume_source: string; volume_observed_at: string | null; volume_period: string | null; competition: string | null; difficulty_score: number | null; difficulty_source: string | null; cost_per_click: number | null; metric_source: string }
export interface KeywordOpportunity { id: string; keyword_id: string; total_score: number | null; relevance_score: number | null; intent_score: number | null; demand_score: number | null; feasibility_score: number | null; differentiation_score: number | null; status: string; proposed_angle: string; cannibalization_report: unknown[]; keyword?: JournalKeyword; metric?: KeywordMetric }
