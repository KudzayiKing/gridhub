import type { KeywordMetric } from "./types";

export interface KeywordResearchProvider {
  readonly id: string;
  getKeywordMetrics(keywords: string[], location: string, language: string): Promise<KeywordMetric[]>;
  getRelatedKeywords(keyword: string, location: string, language: string): Promise<string[]>;
}

/** No remote provider is selected by default; imported CSV observations remain the initial source. */
export function getConfiguredKeywordProvider(): KeywordResearchProvider | null {
  return null;
}
