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
    a: "The typed assistant is in development. Quick add is available for entering records directly, and voice input is planned for a later release.",
  },
  {
    q: "Will GridHub AI cost extra?",
    a: "No. When it ships it will be included in every plan, including Free. Your plan decides which applications you can open, not whether you can use the assistant.",
  },
  {
    q: "Does GridHub AI send my requests to a server?",
    a: "Typed requests run in your browser after the optional model download. Your records still sync to your private workspace the way they do today — the assistant does not change how sync works.",
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
