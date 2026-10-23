export interface OpportunityInputs {
  relevance: number | null;
  intent: number | null;
  demand: number | null;
  feasibility: number | null;
  differentiation: number | null;
}
export const DEFAULT_WEIGHTS = { relevance: 30, intent: 25, demand: 20, feasibility: 15, differentiation: 10 } as const;

/** Weighted mean of supplied 0..100 component scores; missing dimensions are omitted, never treated as zero. */
export function scoreOpportunity(inputs: OpportunityInputs, weights: Record<keyof OpportunityInputs, number> = DEFAULT_WEIGHTS) {
  const parts = Object.entries(inputs) as [keyof OpportunityInputs, number | null][];
  const available = parts.filter(([key, value]) => value !== null && Number.isFinite(value) && weights[key] > 0);
  if (!available.length) return { total: null, coveragePercent: 0, components: inputs };
  const weightTotal = available.reduce((sum, [key]) => sum + weights[key], 0);
  const total = available.reduce((sum, [key, value]) => sum + Math.max(0, Math.min(100, value!)) * weights[key], 0) / weightTotal;
  const coveragePercent = Math.round(weightTotal / Object.values(weights).reduce((a, b) => a + b, 0) * 100);
  return { total: Math.round(total * 10) / 10, coveragePercent, components: inputs };
}

export function normalizeKeyword(keyword: string) {
  return keyword.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function findKeywordOverlap(keyword: string, existing: { title: string; primary_keyword: string; slug: string }[]) {
  const normalized = normalizeKeyword(keyword);
  const terms = new Set(normalized.split(" ").filter((term) => term.length > 2));
  return existing.flatMap((article) => {
    const title = normalizeKeyword(article.title);
    const primary = normalizeKeyword(article.primary_keyword);
    const exact = primary && (primary === normalized || primary.includes(normalized) || normalized.includes(primary));
    const overlap = title.split(" ").filter((term) => terms.has(term)).length;
    const ratio = terms.size ? overlap / terms.size : 0;
    return exact || ratio >= 0.6 ? [{ slug: article.slug, title: article.title, overlap: exact ? 1 : ratio }] : [];
  }).sort((a, b) => b.overlap - a.overlap);
}
