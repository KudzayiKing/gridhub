export const FREE_TOOL_ANALYTICS_CONSENT_KEY = "gridhub-free-tool-analytics-consent";
const SESSION_KEY = "gridhub-free-tool-analytics-session";
export type FreeToolEvent = "calculator_view" | "signup_click";

export function trackFreeToolEvent(event: FreeToolEvent, toolId: string) {
  if (typeof window === "undefined" || window.localStorage.getItem(FREE_TOOL_ANALYTICS_CONSENT_KEY) !== "yes") return;
  try {
    let sessionId = window.sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    void fetch("/api/marketing-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, toolId, sessionId }),
      keepalive: true,
    }).catch(() => undefined);
  } catch { /* Analytics must never interrupt calculator use. */ }
}
