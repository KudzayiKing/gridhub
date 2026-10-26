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
 * Creates the engine, preferring WebGPU and falling back to CPU.
 *
 * GPU creation can succeed at the API level and still fail when the shader compiles, so the fallback
 * is a real retry rather than a capability check.
 */
export async function createEngine(options: CreateEngineOptions): Promise<Engine> {
  const litert = await import("@litert-lm/core");
  options.onStatus?.("loading-runtime");

  await litert.getOrLoadGlobalLiteRtLm(LITERT_WASM_PATH);

  options.onStatus?.("loading-model");
  // Prefer the cached artifact; fall back to the URL only when nothing is installed.
  const cached = await getModelBlob(options.manifest);
  const model = cached ?? options.manifest.sourceUrl;

  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  let gpuError: unknown;

  if (hasWebGpu) {
    try {
      options.onStatus?.("creating-engine-gpu");
      return await litert.Engine.create({ model, backend: litert.Backend.GPU });
    } catch (error) {
      // Keep the cause so a failed CPU fallback does not hide why GPU initialization failed.
      gpuError = error;
    }
  }

  options.onStatus?.("creating-engine-cpu");
  try {
    return await litert.Engine.create({ model, backend: litert.Backend.CPU });
  } catch (cpuError) {
    if (!gpuError) throw cpuError;
    throw new Error(
      `On-device AI could not initialize either backend. WebGPU: ${describeError(gpuError)} CPU: ${describeError(cpuError)}`,
    );
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
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
