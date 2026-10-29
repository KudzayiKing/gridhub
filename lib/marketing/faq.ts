/**
 * Public FAQ copy, shared by the `/faq` page body, its FAQPage JSON-LD and `/pricing`.
 *
 * The English strings live here once and are translated at render time, so the structured data
 * and the visible list can never disagree. `tests/i18n-coverage.test.ts` walks these exports and
 * requires a translation for every string.
 */

import { AI_FAQ, type MarketingFaqItem } from "./ai-faq";

export interface MarketingFaqGroup {
  title: string;
  items: MarketingFaqItem[];
}

export const FAQ_GROUPS: MarketingFaqGroup[] = [
  {
    title: "Product",
    items: [
      {
        q: "What exactly do I get?",
        a: "A personal workspace plus the tools you choose. Each tool has its own dashboard, editable records, tables, search, filters, reporting and export.",
      },
      {
        q: "Is it a spreadsheet?",
        a: "No. You never write formulas. Calculations are built into each tool and documented, and they use decimal-safe arithmetic.",
      },
      {
        q: "Can I use more than one tool?",
        a: "Yes — that is the point. Plans cover 1, 3, 6 or all 16 tools, and related tools share records so you do not re-enter data.",
      },
      {
        q: "Do tools share data?",
        a: "Where it is safe and meaningful: customers, products and business money movements are shared. Personal nutrition data is never linked to business records.",
      },
    ],
  },
  {
    title: "GridHub AI",
    items: AI_FAQ,
  },
  {
    title: "Billing",
    items: [
      {
        q: "How much does it cost?",
        a: "Free for one limited starter tool. Single $3/mo or $29/yr, Plus $7/$69, Pro $11/$109, Unlimited $15/$149.",
      },
      {
        q: "Can I switch plans?",
        a: "Yes. Upgrades take effect immediately; downgrades apply at the end of the period. Stripe handles proration.",
      },
      {
        q: "What happens if I cancel?",
        a: "Access continues to the end of the paid period. Records are retained and remain exportable; tools become read-only rather than disappearing.",
      },
    ],
  },
  {
    title: "Offline & data",
    items: [
      {
        q: "Does it work without internet?",
        a: "Yes, after one online sign-in and load. Records and pending edits are stored on the device, then synced.",
      },
      {
        q: "Will I lose edits made offline?",
        a: "No. Edits queue in an outbox and retry. A mutation is only cleared after the server acknowledges it.",
      },
      {
        q: "Can I export everything?",
        a: "Yes — CSV per table and a full JSON archive of your workspace. Export is available on every plan.",
      },
      {
        q: "Where is my data stored?",
        a: "On your device first, then in your private Supabase workspace when you are signed in. Row-level security isolates your records.",
      },
    ],
  },
];

/** Billing questions shown on /pricing, also emitted as FAQPage structured data. */
export const BILLING_FAQ: MarketingFaqItem[] = [
  {
    q: "How does the free plan work?",
    a: "The Annual Budget Planner is available with basic current-month budgeting, manual transactions and essential summary metrics. Data export is included.",
  },
  {
    q: "What if I need to change tools mid-cycle?",
    a: "Single, Plus and Pro allow one tool swap per billing cycle. Upgrades take effect immediately and are prorated by Stripe. Unlimited has no restrictions.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, at any time from the customer portal. Access continues to the end of the paid period, and your records remain available for export.",
  },
  {
    q: "Do you offer refunds?",
    a: "See the refund policy for the exact terms. We aim to be reasonable: if something did not work, contact us and we will make it right.",
  },
];

/** The five things every paid plan includes, shown on /pricing. */
export const PLAN_INCLUDES: string[] = [
  "Offline editing and installable PWA",
  "CSV and JSON export of your records",
  "Google sign-in and a private workspace",
  "Dark mode and reduced-motion support",
  "Data retained after cancellation",
  "The same privacy protections on every tier",
];
