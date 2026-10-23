export const FREE_TOOL_DRAFT_KEY = "gridhub-free-tool-draft";
const CHANGE_EVENT = "gridhub-free-tool-draft-change";

/** A primitive snapshot keeps useSyncExternalStore stable between reads. */
export function getFreeToolDraftSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.sessionStorage.getItem(FREE_TOOL_DRAFT_KEY) ?? "";
    if (!raw) return "";
    const draft = JSON.parse(raw) as { version?: number; expiresAt?: number };
    return draft.version === 1 && typeof draft.expiresAt === "number" && draft.expiresAt > Date.now() ? raw : "";
  }
  catch { return ""; }
}

export function subscribeFreeToolDraft(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function notifyFreeToolDraftChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}
