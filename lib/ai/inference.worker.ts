/**
 * Gridhub AI — inference worker.
 *
 * The model runs here, not on the main thread: a 2B model on the CPU backend would otherwise block
 * input, animations and scrolling for the whole duration of a command. The worker owns exactly one
 * engine and one in-flight conversation.
 *
 * Protocol (main → worker):
 *   { type: "init", sourceUrl, manifest }
 *   { type: "generate", id, prompt }
 *   { type: "cancel", id }
 *   { type: "dispose" }
 *
 * Protocol (worker → main):
 *   { type: "boot" }                       — script evaluated
 *   { type: "status", status }             — progress through init
 *   { type: "ready" }
 *   { type: "result", id, text }
 *   { type: "error", id?, message, fatal? }
 */

import type { Engine } from "@litert-lm/core";
import type { AIModelManifest } from "./model-manifest";
import { createEngine, disposeEngine, generate } from "./litert-engine";

type Incoming =
  | { type: "init"; manifest: AIModelManifest }
  | { type: "generate"; id: number; prompt: string }
  | { type: "cancel"; id: number }
  | { type: "dispose" };

let engine: Engine | null = null;
let initializing: Promise<void> | null = null;
const active = new Map<number, () => void>();

function post(message: unknown) {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);
}

async function init(manifest: AIModelManifest) {
  if (engine) {
    post({ type: "ready" });
    return;
  }
  if (!initializing) {
    initializing = (async () => {
      try {
        engine = await createEngine({
          manifest,
          onStatus: (status) => post({ type: "status", status }),
        });
        post({ type: "ready" });
      } catch (error) {
        engine = null;
        initializing = null;
        post({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
          fatal: true,
        });
      }
    })();
  }
  return initializing;
}

self.addEventListener("message", (event: MessageEvent<Incoming>) => {
  const data = event.data;

  if (data.type === "init") {
    void init(data.manifest);
    return;
  }

  if (data.type === "generate") {
    void (async () => {
      try {
        if (!engine) throw new Error("The local model is not ready.");
        const text = await generate(engine, data.prompt, {
          onCancelReady: (cancel) => active.set(data.id, cancel),
        });
        post({ type: "result", id: data.id, text });
      } catch (error) {
        post({
          type: "error",
          id: data.id,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        active.delete(data.id);
      }
    })();
    return;
  }

  if (data.type === "cancel") {
    active.get(data.id)?.();
    active.delete(data.id);
    return;
  }

  if (data.type === "dispose") {
    void (async () => {
      await disposeEngine(engine);
      engine = null;
      initializing = null;
      post({ type: "disposed" });
    })();
  }
});

post({ type: "boot" });
