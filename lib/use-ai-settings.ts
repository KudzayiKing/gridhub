"use client";

/**
 * Gridhub AI — settings as an external store.
 *
 * Settings live in localStorage and change from another route, so they are read through
 * `useSyncExternalStore` rather than copied into state on mount. That keeps the server render and the
 * first client render identical (both see defaults), then re-renders once with the real values —
 * no hydration mismatch and no setState-in-effect.
 */

import * as React from "react";
import {
  getAISettingsServerSnapshot,
  getAISettingsSnapshot,
  subscribeAISettings,
  writeAISettings,
  type AISettings,
} from "./ai/ai-privacy";

export function useAISettings(): {
  settings: AISettings;
  update: (patch: Partial<AISettings>) => AISettings;
} {
  const settings = React.useSyncExternalStore(
    subscribeAISettings,
    getAISettingsSnapshot,
    getAISettingsServerSnapshot,
  );

  const update = React.useCallback((patch: Partial<AISettings>) => writeAISettings(patch), []);

  return { settings, update };
}
