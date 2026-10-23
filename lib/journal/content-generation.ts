import type { JournalRevision } from "./types";

export interface ArticleBrief {
  proposedTitle: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  sources: { title: string; url: string; publisher: string; verified: boolean }[];
  factsToVerify: string[];
  proposedHeadings: string[];
  editorialRisks: string[];
}

export interface ContentGenerationProvider {
  readonly id: string;
  generateDraft(brief: ArticleBrief, sourceMaterial: ArticleBrief["sources"]): Promise<Pick<JournalRevision, "body_markdown" | "change_note">>;
}

/** Interactive Codex execution is not a callable unattended worker in this deployment. */
export function getConfiguredContentProvider(): ContentGenerationProvider | null {
  return null;
}
