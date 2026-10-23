"use client";
import * as React from "react";
import { JOURNAL_ANALYTICS_CONSENT_KEY, trackJournalEvent } from "@/lib/journal/analytics";
import { Button } from "@/components/ui/button";
const CONSENT_CHANGE_EVENT = "gridhub-journal-consent-change";
function subscribeConsent(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(CONSENT_CHANGE_EVENT, callback); };
}
function getConsent() { return window.localStorage.getItem(JOURNAL_ANALYTICS_CONSENT_KEY); }
function getServerConsent() { return null; }
export function JournalArticleAnalytics({ articleId }: { articleId: string }) {
  const choice = React.useSyncExternalStore(subscribeConsent, getConsent, getServerConsent);
  React.useEffect(() => { if (choice === "yes") trackJournalEvent(articleId, "journal_article_viewed"); }, [articleId, choice]);
  const choose = (answer: "yes" | "no") => { window.localStorage.setItem(JOURNAL_ANALYTICS_CONSENT_KEY, answer); window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT)); };
  return choice ? <div className="mt-6 text-right"><button className="text-[10px] text-fg-subtle underline" onClick={() => choose(choice === "yes" ? "no" : "yes")}>{choice === "yes" ? "Turn off anonymous Journal analytics" : "Allow anonymous Journal analytics"}</button></div> : <aside className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3"><p className="max-w-2xl text-[11px] leading-relaxed text-fg-muted">May we count anonymous article views and GridHub link clicks to understand which guides help? We do not collect your identity or article content.</p><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => choose("no")}>No thanks</Button><Button size="sm" variant="secondary" onClick={() => choose("yes")}>Allow</Button></div></aside>;
}
