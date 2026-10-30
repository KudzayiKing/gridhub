/**
 * Gridhub AI — local history and privacy controls.
 *
 * Conversation history never leaves the device. It is small, human-readable metadata kept in
 * localStorage, separate from the customer's records in IndexedDB, so "Clear AI history" can never
 * touch business data.
 */

export type HistoryRetention = "session" | "7days" | "30days" | "off";

export interface AIHistoryEntry {
  id: string;
  at: number;
  /** What the user said or typed. */
  text: string;
  /** Short description of what happened, e.g. "Added expense · $45.00". */
  outcome: string;
  toolId?: string;
  source: "voice" | "text" | "deterministic" | "model";
}

export interface AISettings {
  /** Master switch for the text assistant panel and model. */
  enabled: boolean;
  /** Retained for compatibility with saved settings; voice input is currently unavailable. */
  voice: boolean;
  /** How long command history is kept. */
  retention: HistoryRetention;
  /** BCP-47 tag used for prompts and speech recognition hints. */
  locale: string;
}

/**
 * Locales recognized by the on-device command parser. Voice recognition remains a separate,
 * currently unavailable capability; this list is used for the text command language preference.
 */
export const SUPPORTED_AI_LOCALES = ["en", "es", "zh-CN", "pt-BR", "fr", "ru", "ar"] as const;

const HISTORY_KEY = "gridhub.ai.history";
const SETTINGS_KEY = "gridhub.ai.settings";
const MAX_ENTRIES = 40;

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: true,
  voice: true,
  retention: "30days",
  locale: "en",
};

const RETENTION_MS: Record<HistoryRetention, number> = {
  session: 1000 * 60 * 60 * 12,
  "7days": 1000 * 60 * 60 * 24 * 7,
  "30days": 1000 * 60 * 60 * 24 * 30,
  off: 0,
};

function parseSettings(raw: string | null): AISettings {
  if (!raw) return { ...DEFAULT_AI_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    const locale = (SUPPORTED_AI_LOCALES as readonly string[]).includes(parsed.locale ?? "")
      ? (parsed.locale as string)
      : DEFAULT_AI_SETTINGS.locale;
    return {
      enabled: parsed.enabled ?? DEFAULT_AI_SETTINGS.enabled,
      voice: parsed.voice ?? DEFAULT_AI_SETTINGS.voice,
      retention: parsed.retention ?? DEFAULT_AI_SETTINGS.retention,
      locale,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function readAISettings(): AISettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

/*
 * A cached snapshot for `useSyncExternalStore`. React calls the getter on every render and bails out
 * only when the reference is unchanged, so returning a freshly parsed object each time would loop
 * forever. The cache is keyed on the raw string, which is the only thing that can change it.
 */
let snapshotRaw: string | null = null;
let snapshotValue: AISettings = { ...DEFAULT_AI_SETTINGS };
let snapshotValid = false;

export function getAISettingsSnapshot(): AISettings {
  if (typeof localStorage === "undefined") return DEFAULT_AI_SETTINGS;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
  if (!snapshotValid || raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotValue = parseSettings(raw);
    snapshotValid = true;
  }
  return snapshotValue;
}

/** Server snapshot: settings are device-scoped, so there is nothing to render on the server. */
export function getAISettingsServerSnapshot(): AISettings {
  return DEFAULT_AI_SETTINGS;
}

export function subscribeAISettings(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AI_SETTINGS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(AI_SETTINGS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function writeAISettings(patch: Partial<AISettings>): AISettings {
  const next = { ...readAISettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the setting is still applied in memory by the caller.
  }
  if (next.retention === "off") clearAIHistory();
  // Let mounted components (the floating button, the panel) react without a reload.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
  }
  return next;
}

export const AI_SETTINGS_EVENT = "gridhub-ai-settings";

export function readAIHistory(): AIHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as AIHistoryEntry[];
    if (!Array.isArray(entries)) return [];
    const cutoff = retentionCutoff(readAISettings().retention);
    const fresh = cutoff ? entries.filter((e) => e.at >= cutoff) : [];
    return fresh.sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function retentionCutoff(retention: HistoryRetention): number | null {
  const window = RETENTION_MS[retention];
  if (!window) return null;
  return Date.now() - window;
}

export function appendAIHistory(entry: Omit<AIHistoryEntry, "id" | "at">): AIHistoryEntry[] {
  const settings = readAISettings();
  if (settings.retention === "off") return [];
  const record: AIHistoryEntry = {
    ...entry,
    id: `aih_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
  };
  const next = [record, ...readAIHistory()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: history is a convenience, never a requirement.
  }
  return next;
}

export function clearAIHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Facts worth showing in Settings → Gridhub AI. Kept as data rather than prose so the UI and the
 * docs cannot drift apart.
 */
export const PRIVACY_FACTS: { title: string; detail: string }[] = [
  {
    title: "Commands stay on this device",
    detail:
      "The model runs inside your browser. What you say or type is never sent to a server, and there is no API key or hosted endpoint involved.",
  },
  {
    title: "Quick add uses the regular forms",
    detail:
      "Quick add uses the same validated record forms and local save path as the tools themselves.",
  },
  {
    title: "Your records are not sent to the model",
    detail:
      "Only the names of records you already have (for example category names) are used to resolve what you meant. Balances and totals are calculated by Gridhub's own code, not guessed by the model.",
  },
  {
    title: "The model only proposes, never writes",
    detail:
      "Every change is a proposal you confirm. Changes go through the same save path as manual entry, so they queue and sync like anything else.",
  },
  {
    title: "No background activity",
    detail:
      "The assistant only runs after you submit a typed request. Quick add waits for you to enter and save a record.",
  },
];
