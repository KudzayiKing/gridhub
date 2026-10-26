"use client";

/**
 * Gridhub AI — shared state.
 *
 * One provider for the whole authenticated shell so the floating button, the panel and the settings
 * page all read the same conversation and the same microphone. The model is never loaded here; only
 * its cached-ness is checked, which is a localStorage read.
 */

import * as React from "react";
import { usePrefs } from "@/components/providers";
import { useAIModel, type UseAIModel } from "@/lib/use-ai-model";
import { useAIRecorder, type UseAIRecorder } from "@/lib/use-ai-recorder";
import { useAISpeech, type UseAISpeech } from "@/lib/use-ai-speech";
import { useGridhubAIController, type GridhubAIController } from "@/lib/use-gridhub-ai";
import { AI_ENABLED } from "@/lib/ai/model-manifest";
import { useAISettings } from "@/lib/use-ai-settings";

interface GridhubAIContextValue {
  ai: GridhubAIController;
  model: UseAIModel;
  recorder: UseAIRecorder;
  speech: UseAISpeech;
  /** Opens the panel and starts listening. Safe to call when the mic is unavailable. */
  listen: () => Promise<void>;
  /**
   * Stops listening, transcribes locally, and submits the transcript.
   *
   * `autoSubmit: false` puts the words in the composer instead, so the panel can offer an editable
   * transcript before anything is sent.
   */
  stopListening: (options?: { autoSubmit?: boolean }) => Promise<void>;
  /** Master switch: the assistant is visible at all. */
  enabled: boolean;
  /** Whether the microphone may be used. */
  voiceEnabled: boolean;
}

const GridhubAIContext = React.createContext<GridhubAIContextValue | null>(null);

export function GridhubAIProvider({ children }: { children: React.ReactNode }) {
  const model = useAIModel();
  const speech = useAISpeech();
  const ai = useGridhubAIController({
    modelReady: model.status === "ready" && model.capabilities?.webgpu === true,
  });
  const { prefs } = usePrefs();
  // Settings are device-scoped and change on another route, so they come from an external store.
  const { settings } = useAISettings();

  const submitRef = React.useRef(ai.submit);
  const transcriptRef = React.useRef(ai.setTranscript);

  React.useEffect(() => {
    submitRef.current = ai.submit;
    transcriptRef.current = ai.setTranscript;
  }, [ai.submit, ai.setTranscript]);

  const handleAutoStop = React.useCallback((text: string | null) => {
    if (!text) return;
    transcriptRef.current(text);
    void submitRef.current(text);
  }, []);

  const recorder = useAIRecorder({
    language: prefs.locale?.split("-")[0] || "en",
    onAutoStop: handleAutoStop,
  });

  const voiceAllowed = settings.voice && recorder.supported && speech.status === "ready";

  const listen = React.useCallback(async () => {
    // Never open the microphone for a preference that is off or a model that is not installed.
    if (!voiceAllowed) return;
    await recorder.start();
  }, [voiceAllowed, recorder]);

  const stopListening = React.useCallback(
    async (options?: { autoSubmit?: boolean }) => {
      const text = await recorder.stop();
      if (!text) return;
      ai.setTranscript(text);
      if (options?.autoSubmit !== false) await ai.submit(text);
    },
    [recorder, ai],
  );

  const value = React.useMemo<GridhubAIContextValue>(
    () => ({
      ai,
      model,
      recorder,
      speech,
      listen,
      stopListening,
      enabled: AI_ENABLED && settings.enabled,
      // Voice needs three things: the preference, a microphone, and an installed speech model.
      voiceEnabled: voiceAllowed,
    }),
    [ai, model, recorder, speech, listen, stopListening, settings.enabled, voiceAllowed],
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
