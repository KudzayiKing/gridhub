export const JOURNAL_ANALYTICS_CONSENT_KEY = "gridhub-journal-analytics-consent";
const JOURNAL_SESSION_KEY = "gridhub-journal-anonymous-session";
export type JournalEvent = "journal_article_viewed" | "journal_cta_clicked" | "journal_calculator_opened";
export function trackJournalEvent(articleId: string, eventName: JournalEvent) {
  try {
    if (typeof window === "undefined" || window.localStorage.getItem(JOURNAL_ANALYTICS_CONSENT_KEY) !== "yes") return;
    let sessionId = window.sessionStorage.getItem(JOURNAL_SESSION_KEY);
    if (!sessionId) { sessionId = crypto.randomUUID(); window.sessionStorage.setItem(JOURNAL_SESSION_KEY, sessionId); }
    void fetch("/api/journal/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ articleId, eventName, sessionId }), keepalive: true }).catch(() => undefined);
  } catch { /* Analytics must not affect reading or navigation. */ }
}
