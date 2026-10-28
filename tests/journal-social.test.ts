import { describe, expect, it } from "vitest";
import { createSocialDrafts } from "@/lib/journal/social";

const debtArticle = {
  title: "Debt Snowball vs. Avalanche: How to Choose a Payoff Strategy",
  excerpt: "Compare the debt snowball and avalanche payoff methods, decide where extra payments go, and build a payoff plan you can keep following.",
  slug: "debt-snowball-vs-avalanche-payoff-strategy",
  body_markdown: "Snowball targets smaller balance. Avalanche targets higher APR.",
  related_calculator_slug: "debt-payoff-calculator",
};

describe("Journal social draft templates", () => {
  it("creates distinct source-linked drafts for the four requested channels", () => {
    const drafts = createSocialDrafts(debtArticle, ["x", "linkedin", "instagram", "youtube_shorts"]);
    expect(drafts.map((draft) => draft.platform)).toEqual(["x", "linkedin", "instagram", "youtube_shorts"]);
    expect(new Set(drafts.map((draft) => draft.body)).size).toBe(4);
    for (const draft of drafts) {
      expect(draft.body).toContain("https://www.gridhub.online/journal/debt-snowball-vs-avalanche-payoff-strategy");
      expect(draft.ctaUrl).toBe("https://www.gridhub.online/free-tools/debt-payoff-calculator");
    }
    expect(drafts.find((draft) => draft.platform === "youtube_shorts")?.creativeBrief.videoAssetRequired).toBe(true);
  });

  it("uses only the supplied excerpt for articles without a debt-specific template", () => {
    const drafts = createSocialDrafts({ ...debtArticle, title: "A Savings Guide", slug: "savings-guide" }, ["x"]);
    expect(drafts[0].body).toContain(debtArticle.excerpt);
    expect(drafts[0].body).not.toContain("Snowball");
  });
});
