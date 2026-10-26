/**
 * Gridhub AI — LiteRT-LM engine lifecycle, shared by the worker and the inline fallback.
 *
 * Deliberately free of `window`/`document` so the identical code can run inside a dedicated worker
 * (where the model belongs) and on the main thread (fallback when workers are unavailable).
 */

import type { Conversation, Engine } from "@litert-lm/core";
import type { AIModelManifest } from "./model-manifest";
import { LITERT_WASM_PATH } from "./model-manifest";
import { getModelBlob } from "./model-manager";
import { elapsedMs, logAIDiagnostic } from "./diagnostics";

/**
 * One sentence of framing. The real contract (allowed actions, exact JSON shape) is in the user
 * prompt built by `context-builder`, because it changes per request.
 */
export const SYSTEM_PREFACE =
  "You are Gridhub AI, an assistant inside a personal finance and business app. " +
  "You reply with exactly one minified JSON object matching the requested shape. " +
  "You never reply with prose, markdown or code fences.";

export interface CreateEngineOptions {
  manifest: AIModelManifest;
  onStatus?: (status: string) => void;
}

/**
 * Creates the engine with LiteRT-LM's default GPU Artisan backend. The Gemma web model is packaged
 * for that streaming WebGPU executor; forcing the plain GPU enum is unsupported by this runtime,
 * and the model does not contain the CPU prefill section needed for a CPU fallback.
 */
export async function createEngine(options: CreateEngineOptions): Promise<Engine> {
  const initStarted = performance.now();
  const litert = await import("@litert-lm/core");
  options.onStatus?.("loading-runtime");

  // LiteRT's generated WASM loader normally derives the .wasm URL from the injected JS script.
  // In a dedicated worker, that script is loaded with importScripts(), so currentScript is absent
  // and LiteRT incorrectly resolves the binary beside the worker bundle under /_next/static/.
  // Supplying locateFile makes both worker and inline initialization load the binary from /ai/wasm.
  const wasmBaseUrl = new URL(
    LITERT_WASM_PATH.endsWith("/") ? LITERT_WASM_PATH : `${LITERT_WASM_PATH}/`,
    globalThis.location.href,
  );
  const runtimeGlobal = globalThis as typeof globalThis & {
    Module?: { locateFile?: (file: string) => string; [key: string]: unknown };
  };
  runtimeGlobal.Module = {
    ...runtimeGlobal.Module,
    locateFile: (file) => new URL(file, wasmBaseUrl).href,
  };

  const runtimeStarted = performance.now();
  await litert.getOrLoadGlobalLiteRtLm(LITERT_WASM_PATH);
  const runtimeMs = elapsedMs(runtimeStarted);

  options.onStatus?.("loading-model");
  // A valid installation must have the verified artifact in Cache API; never hide a 2 GB refetch
  // inside engine initialization when browser storage has evicted it.
  const cacheStarted = performance.now();
  const cached = await getModelBlob(options.manifest);
  const cacheLookupMs = elapsedMs(cacheStarted);

  if (!cached) {
    throw new Error(
      "The verified local model file is missing from this browser's cache. Reinstall the model before using on-device AI.",
    );
  }

  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    throw new Error("This on-device AI model requires a browser with WebGPU support.");
  }

  options.onStatus?.("creating-engine-gpu");
  // Omitting `backend` selects LiteRT-LM's GPU_ARTISAN backend, which supports this web model.
  const engineStarted = performance.now();
  try {
    const engine = await litert.Engine.create({ model: cached });
    const nav = typeof navigator === "undefined" ? null : navigator;
    logAIDiagnostic("engine-ready", {
      runtimeVersion: "@litert-lm/core 0.18.0",
      modelId: options.manifest.id,
      modelBytes: cached.size,
      cachedModel: true,
      backendRequested: "GPU_ARTISAN (LiteRT-LM default)",
      backendConfigured: engine.settings.backend,
      webgpuAvailable: Boolean(nav && "gpu" in nav),
      runtimeLoadMs: runtimeMs,
      modelCacheLookupMs: cacheLookupMs,
      engineCreateMs: elapsedMs(engineStarted),
      engineInitTotalMs: elapsedMs(initStarted),
      browser: nav?.userAgent ?? "unknown",
      platform: nav?.platform ?? "unknown",
      hardwareConcurrency: nav?.hardwareConcurrency ?? null,
      deviceMemoryGiB: (nav as Navigator & { deviceMemory?: number } | null)?.deviceMemory ?? null,
    });
    return engine;
  } catch (error) {
    logAIDiagnostic("engine-init-failed", {
      modelId: options.manifest.id,
      cachedModel: true,
      backendRequested: "GPU_ARTISAN (LiteRT-LM default)",
      runtimeLoadMs: runtimeMs,
      modelCacheLookupMs: cacheLookupMs,
      engineCreateMs: elapsedMs(engineStarted),
      errorName: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}

export interface GenerateOptions {
  signal?: AbortSignal;
  onCancelReady?: (cancel: () => void) => void;
}

/** Runs one prompt in a fresh conversation, so history never bleeds between commands. */
export async function generate(
  engine: Engine,
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> {
  const inferenceStarted = performance.now();
  const conversation: Conversation = await engine.createConversation({
    preface: { messages: [{ role: "system", content: SYSTEM_PREFACE }] },
  });

  const cancel = () => {
    try {
      void conversation.cancel();
    } catch {
      // Cancelling a finished conversation is a no-op.
    }
  };

  options.onCancelReady?.(cancel);
  const onAbort = () => cancel();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const streamStarted = performance.now();
    const stream = conversation.sendMessageStreaming(prompt);
    const reader = stream.getReader();
    let firstContentMs: number | null = null;
    let output = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const content = value?.content;
        const chunk = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map((part) => part && typeof part === "object" && "text" in part ? String(part.text) : "").join("")
            : "";
        if (chunk) {
          firstContentMs ??= elapsedMs(streamStarted);
          output += chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
    let benchmarkInfo: Awaited<ReturnType<Conversation["getBenchmarkInfo"]>> | null = null;
    try {
      benchmarkInfo = await conversation.getBenchmarkInfo();
    } catch {
      // Older runtime builds may not expose benchmark counters.
    }
    logAIDiagnostic("text-inference-complete", {
      firstContentMs,
      inferenceTotalMs: elapsedMs(inferenceStarted),
      prefillTokensPerSecond: benchmarkInfo?.lastPrefillTokensPerSecond ?? null,
      prefillTokenCount: benchmarkInfo?.lastPrefillTokenCount ?? null,
      decodeTokensPerSecond: benchmarkInfo?.lastDecodeTokensPerSecond ?? null,
      decodeTokenCount: benchmarkInfo?.lastDecodeTokenCount ?? null,
      runtimeTimeToFirstTokenSeconds: benchmarkInfo?.timeToFirstTokenInSecond ?? null,
      outputCharacters: output.length,
    });
    return output;
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    try {
      await conversation.delete();
    } catch {
      // Deleting a conversation is best-effort.
    }
  }
}

export async function disposeEngine(engine: Engine | null): Promise<void> {
  if (!engine) return;
  try {
    await engine.delete();
  } catch {
    // ignore
  }
}
