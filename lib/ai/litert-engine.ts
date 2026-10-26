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

  await litert.getOrLoadGlobalLiteRtLm(LITERT_WASM_PATH);

  options.onStatus?.("loading-model");
  // Prefer the cached artifact; fall back to the URL only when nothing is installed.
  const cached = await getModelBlob(options.manifest);
  const model = cached ?? options.manifest.sourceUrl;

  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    throw new Error("This on-device AI model requires a browser with WebGPU support.");
  }

  options.onStatus?.("creating-engine-gpu");
  // Omitting `backend` selects LiteRT-LM's GPU_ARTISAN backend, which supports this web model.
  return litert.Engine.create({ model });
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
    const message = await conversation.sendMessage(prompt);
    const content = message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          part && typeof part === "object" && "text" in part ? String(part.text) : "",
        )
        .join("");
    }
    return "";
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
