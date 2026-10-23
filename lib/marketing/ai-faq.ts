/**
 * GridHub AI questions, shared by the homepage FAQ strip and /faq so the two cannot drift apart.
 *
 * Every answer is written against the current state of the feature: it is in development, nothing
 * is switched on, and the claims are limited to what the code actually does.
 */

export interface MarketingFaqItem {
  q: string;
  a: string;
}

export const AI_FAQ: MarketingFaqItem[] = [
  {
    q: "Is GridHub AI available yet?",
    a: "Not yet. It is in development: the interface and the on-device model integration exist, but we have not finished verifying them end to end on real devices. We will switch it on only once a download, a typed command and a spoken command all work reliably.",
  },
  {
    q: "Will GridHub AI cost extra?",
    a: "No. When it ships it will be included in every plan, including Free. Your plan decides which applications you can open, not whether you can use the assistant.",
  },
  {
    q: "Does GridHub AI send my voice to a server?",
    a: "The design is on-device. After an optional download, the model and speech recognition run inside your browser, so supported commands do not need a cloud AI service. Your records still sync to your private workspace the way they do today — the assistant does not change how sync works.",
  },
  {
    q: "Can AI change my records without asking?",
    a: "No. Anything that writes — an expense, an invoice, a task — is shown first as a confirmation card listing exactly what will be saved. Nothing is written until you confirm, and you can cancel at that step.",
  },
  {
    q: "Does it work offline?",
    a: "Supported commands are designed to work offline once the model has been downloaded. Initial setup and the download itself need an internet connection, and behaviour depends on the device and browser.",
  },
];
