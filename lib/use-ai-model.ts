"use client";

/**
 * Gridhub AI — model lifecycle for the UI.
 *
 * Owns nothing but state: capability detection, whether the model is cached, and the download
 * itself. Inference is started lazily by the command router, never at page load.
 */

import * as React from "react";
import {
  AI_MODEL,
  detectCapabilities,
  type AICapabilities,
  type AIModelManifest,
} from "@/lib/ai/model-manifest";
import {
  downloadModel,
  isModelInstalled,
  readModelMeta,
  removeModel,
  requestPersistence,
  type DownloadProgress,
  type InstalledModelMeta,
} from "@/lib/ai/model-manager";
import { disposeInferenceProvider } from "@/lib/ai/inference-provider";
import { prewarmInferenceRuntime } from "@/lib/ai/runtime-prefetch";

export type ModelStatus =
  | "checking"
  | "unavailable"
  | "not-installed"
  | "downloading"
  | "ready"
  | "error";

export interface UseAIModel {
  status: ModelStatus;
  capabilities: AICapabilities | null;
  meta: InstalledModelMeta | null;
  manifest: AIModelManifest;
  progress: DownloadProgress | null;
  error: string | null;
  install: () => Promise<void>;
  cancel: () => void;
  remove: () => Promise<void>;
  refresh: () => void;
}

export function useAIModel(): UseAIModel {
  const [status, setStatus] = React.useState<ModelStatus>("checking");
  const [capabilities, setCapabilities] = React.useState<AICapabilities | null>(null);
  const [meta, setMeta] = React.useState<InstalledModelMeta | null>(null);
  const [progress, setProgress] = React.useState<DownloadProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const controller = React.useRef<AbortController | null>(null);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const caps = await detectCapabilities();
      if (!alive) return;
      setCapabilities(caps);

      if (caps.level === "unavailable" || !caps.wasm || !caps.webgpu) {
        setStatus("unavailable");
        return;
      }

      const installed = await isModelInstalled(AI_MODEL);
      setMeta(installed ? readModelMeta() : null);
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
      // Ask for durable storage before writing a large artifact.
      await requestPersistence();
      const installed = await downloadModel(AI_MODEL, {
        signal: ac.signal,
        onProgress: setProgress,
      });
      setMeta(installed);
      setProgress(null);
      setStatus("ready");
      /*
       * Fire-and-forget. The model is on disk, but the WASM runtime that runs it is not, and
       * without it "works offline" would be false until the first online command. Failures are
       * ignored: the next command fetches it anyway.
       */
      void prewarmInferenceRuntime();
    } catch (err) {
      if (ac.signal.aborted) {
        setProgress(null);
        setStatus("not-installed");
        return;
      }
      setError(err instanceof Error ? err.message : "The model could not be downloaded.");
      setStatus("error");
    } finally {
      controller.current = null;
    }
  }, []);

  const cancel = React.useCallback(() => {
    controller.current?.abort();
  }, []);

  const remove = React.useCallback(async () => {
    await removeModel(AI_MODEL);
    await disposeInferenceProvider();
    setMeta(null);
    setStatus("not-installed");
  }, []);

  // Abort an in-flight download if the component unmounts.
  React.useEffect(() => () => controller.current?.abort(), []);

  return {
    status,
    capabilities,
    meta,
    manifest: AI_MODEL,
    progress,
    error,
    install,
    cancel,
    remove,
    refresh,
  };
}
