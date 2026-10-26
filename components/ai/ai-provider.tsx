"use client";

/**
 * Gridhub AI — shared state.
 *
 * One provider for the whole authenticated shell so the quick-add button, the panel and the settings
 * page share assistant state. The model is never loaded here; only its cached-ness is checked.
 */

import * as React from "react";
import { useAIModel, type UseAIModel } from "@/lib/use-ai-model";
import { useGridhubAIController, type GridhubAIController } from "@/lib/use-gridhub-ai";
import { AI_ENABLED } from "@/lib/ai/model-manifest";
import { useAISettings } from "@/lib/use-ai-settings";

interface GridhubAIContextValue {
  ai: GridhubAIController;
  model: UseAIModel;
  /** Master switch: the assistant is visible at all. */
  enabled: boolean;
}

const GridhubAIContext = React.createContext<GridhubAIContextValue | null>(null);

export function GridhubAIProvider({ children }: { children: React.ReactNode }) {
  const model = useAIModel();
  const ai = useGridhubAIController({
    modelReady: model.status === "ready" && model.capabilities?.webgpu === true,
  });
  // Settings are device-scoped and change on another route, so they come from an external store.
  const { settings } = useAISettings();

  const value = React.useMemo<GridhubAIContextValue>(
    () => ({
      ai,
      model,
      enabled: AI_ENABLED && settings.enabled,
    }),
    [ai, model, settings.enabled],
  );

  return <GridhubAIContext.Provider value={value}>{children}</GridhubAIContext.Provider>;
}

export function useGridhubAI(): GridhubAIContextValue {
  const value = React.useContext(GridhubAIContext);
  if (!value) throw new Error("useGridhubAI must be used inside <GridhubAIProvider>.");
  return value;
}

/** Safe variant for components that may render outside the shell (marketing pages). */
export function useOptionalGridhubAI(): GridhubAIContextValue | null {
  return React.useContext(GridhubAIContext);
}
