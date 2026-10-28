export type SocialPlatform = "linkedin" | "x" | "instagram" | "youtube_shorts";

export interface SocialSourceArticle {
  title: string;
  excerpt: string;
  slug: string;
  body_markdown: string;
  related_calculator_slug?: string | null;
}

export interface SocialDraftContent {
  platform: SocialPlatform;
  format: string;
  title: string;
  body: string;
  ctaUrl: string;
  creativeBrief: Record<string, unknown>;
}

const publicBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.gridhub.online").replace(/\/$/, "");

function isDebtSnowballArticle(article: SocialSourceArticle) {
  const source = `${article.slug} ${article.title}`.toLowerCase();
  return source.includes("snowball") && source.includes("avalanche");
}

function safeExcerpt(article: SocialSourceArticle) {
  const clean = article.excerpt.trim().replace(/\s+/g, " ");
  return clean || article.title.trim();
}

export function createSocialDrafts(article: SocialSourceArticle, platforms: SocialPlatform[]): SocialDraftContent[] {
  const articleUrl = `${publicBase}/journal/${encodeURIComponent(article.slug)}`;
  const calculatorUrl = article.related_calculator_slug
    ? `${publicBase}/free-tools/${encodeURIComponent(article.related_calculator_slug)}`
    : articleUrl;
  const debt = isDebtSnowballArticle(article);
  const excerpt = safeExcerpt(article);
  const ideas = debt
    ? [
        "Keep paying at least the minimum on every debt.",
        "Snowball: direct extra money to the smallest balance first.",
        "Avalanche: direct extra money to the highest APR first.",
        "The avalanche can reduce interest when the payment and balances are otherwise comparable; the snowball may give an earlier small-balance win.",
      ]
    : [excerpt, "Start with the step that best fits your situation, then turn it into a plan you can follow."];

  return platforms.map((platform) => {
    if (platform === "linkedin") return {
      platform, format: "Educational post", title: article.title,
      body: debt
        ? `When paying off several debts, where should the extra payment go?\n\nThe debt snowball targets the smallest balance first. The debt avalanche targets the highest APR first. Keep making minimum payments on every account either way.\n\nIf your total payment and balances are otherwise comparable, the avalanche generally directs more money away from interest. The snowball can help you reach an earlier payoff milestone. The strategy you can keep following matters.\n\nGridHub’s guide compares the trade-offs and helps you build a plan: ${articleUrl}\n\nTry the Debt Payoff Calculator: ${calculatorUrl}`
        : `${article.title}\n\n${excerpt}\n\nA useful first step: ${ideas[1]}\n\nRead the guide: ${articleUrl}`,
      ctaUrl: calculatorUrl,
      creativeBrief: { visual: "Simple branded comparison graphic: two clearly labeled paths, one for smallest balance and one for highest APR. No promised savings figures." },
    };
    if (platform === "x") return {
      platform, format: "Single post", title: "Snowball or avalanche?",
      body: debt
        ? `Debt payoff: snowball = smallest balance first; avalanche = highest APR first. Keep paying every minimum. Avalanche can reduce interest; snowball may give an earlier win. Pick a plan you can stick with. ${articleUrl}`
        : `${article.title}: ${excerpt} Read the practical guide and make a plan you can follow: ${articleUrl}`,
      ctaUrl: calculatorUrl,
      creativeBrief: { visual: "Text-only post; optional comparison diagram with the two payoff priorities." },
    };
    if (platform === "instagram") return {
      platform, format: "5-slide carousel caption", title: "Snowball vs. avalanche",
      body: debt
        ? `Two common debt payoff strategies, one practical choice.\n\nSwipe through:\n1. Keep paying the minimum on every debt.\n2. Snowball: put extra toward the smallest balance.\n3. Avalanche: put extra toward the highest APR.\n4. Avalanche can reduce interest; snowball can create an earlier payoff milestone.\n5. Choose the approach you can sustain, then track the plan.\n\nRead the full comparison at the link in bio: ${articleUrl}\n\n#DebtPayoff #Budgeting #PersonalFinance #GridHub`
        : `${article.title}\n\n${excerpt}\n\nSave this reminder: make the next step clear, practical, and easy to keep doing. Read more at the link in bio: ${articleUrl}\n\n#PersonalFinance #Planning #GridHub`,
      ctaUrl: calculatorUrl,
      creativeBrief: { aspectRatio: "4:5", slides: debt ? ["The payoff choice", "Snowball: smallest balance", "Avalanche: highest APR", "Trade-off: momentum vs. interest", "Choose and track a sustainable plan"] : [article.title, excerpt, "One practical next step", "Read the full guide"], closingSlide: "GridHub Debt Payoff Calculator", imageNeeded: true },
    };
    return {
      platform, format: "30–45 second Short script", title: `${article.title} | GridHub Short`,
      body: debt
        ? `HOOK (0–4s): “Snowball or avalanche—which debt should you pay extra first?”\n\nVOICEOVER (4–30s): “With the snowball method, keep minimums on every debt and put extra money toward the smallest balance. With the avalanche, keep those minimums and target the highest APR. Avalanche can reduce interest when the payment and balances are otherwise comparable. Snowball can give you an earlier payoff milestone. Choose a strategy you can keep following.”\n\nDEMO (30–38s): Show the GridHub Debt Payoff Calculator and select a payoff strategy. Use a real, current product capture; do not simulate unverified screens.\n\nCLOSE (38–45s): “Compare your plan with the full guide at ${articleUrl}.”\n\nDESCRIPTION: ${article.title}. Educational estimate only; not a lender quote.`
        : `HOOK: “Here is one practical idea from ${article.title}.”\n\nVOICEOVER: “${excerpt} Start with one manageable next step, and adjust your plan to your circumstances.”\n\nCLOSE: “Read the full guide: ${articleUrl}.”\n\nDESCRIPTION: ${article.title}`,
      ctaUrl: calculatorUrl,
      creativeBrief: { aspectRatio: "9:16", durationSeconds: "30–45", scenes: debt ? ["On-camera question", "Simple two-column method labels", "Show actual GridHub calculator screen", "Closing title and article URL"] : ["On-camera hook", "One clear takeaway", "Relevant actual GridHub tool demo if applicable", "Closing title and article URL"], thumbnail: "Snowball vs. avalanche: where should extra payments go?", videoAssetRequired: true },
    };
  });
}

export function platformLabel(platform: SocialPlatform) {
  return platform === "youtube_shorts" ? "YouTube Shorts" : platform === "x" ? "X" : platform === "linkedin" ? "LinkedIn" : "Instagram";
}
