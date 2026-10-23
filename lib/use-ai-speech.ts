"use client";

/**
 * Gridhub AI — speech model install state for the UI.
 *
 * Mirrors `useAIModel`, but for the smaller Whisper checkpoint. Install is explicit and separate:
 * text commands must keep working for someone who never wants voice.
 */

import * as React from "react";
import {
  installSpeechModel,
  isSpeechModelInstalled,
  readSpeechMeta,
  removeSpeechModel,
  type SpeechModelMeta,
  type SpeechProgress,
} from "@/lib/ai/stt-manager";

export type SpeechStatus = "checking" | "not-installed" | "downloading" | "ready" | "error";

export interface UseAISpeech {
  status: SpeechStatus;
  meta: SpeechModelMeta | null;
  progress: SpeechProgress | null;
  error: string | null;
  install: () => Promise<void>;
  cancel: () => void;
  remove: () => Promise<void>;
  refresh: () => void;
}

export function useAISpeech(): UseAISpeech {
  const [status, setStatus] = React.useState<SpeechStatus>("checking");
  const [meta, setMeta] = React.useState<SpeechModelMeta | null>(null);
  const [progress, setProgress] = React.useState<SpeechProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const controller = React.useRef<AbortController | null>(null);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const installed = await isSpeechModelInstalled();
      if (!alive) return;
      setMeta(installed ? readSpeechMeta() : null);
      setStatus(installed ? "ready" : "not-installed");
    })();
    return () => {
      alive = false;
    };
  }, [nonce]);

  const install = React.useCallback(async () => {
    setError(null);
    setProgress(null);
    setStatus("downloading");
    const ac = new AbortController();
    controller.current = ac;
    try {
      const installed = await installSpeechModel({
        signal: ac.signal,
        onProgress: setProgress,
      });
      setMeta(installed);
      setProgress(null);
      setStatus("ready");
    } catch (err) {
      setProgress(null);
      if (ac.signal.aborted) {
        setStatus("not-installed");
        return;
      }
      setError(err instanceof Error ? err.message : "The speech model could not be installed.");
      setStatus("error");
    } finally {
      controller.current = null;
    }
  }, []);

  const cancel = React.useCallback(() => controller.current?.abort(), []);

  const remove = React.useCallback(async () => {
    await removeSpeechModel();
    setMeta(null);
    setStatus("not-installed");
  }, []);

  React.useEffect(() => () => controller.current?.abort(), []);

  return { status, meta, progress, error, install, cancel, remove, refresh };
}
