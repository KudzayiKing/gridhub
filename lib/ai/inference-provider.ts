/**
 * Gridhub AI — local inference provider.
 *
 * Inference runs in a dedicated worker. A 2B model on the CPU backend would block the main thread
 * for the length of every command, freezing input and animation; the worker keeps the UI responsive
 * and lets a command be cancelled without tearing down the page.
 *
 * If a worker cannot be created (older browser, blocked module worker, bundler limitation) the same
 * engine code runs inline. Both paths share `litert-engine.ts`, so behaviour cannot drift.
 */

import type { Engine } from "@litert-lm/core";
import type { AIModelManifest } from "./model-manifest";
import { createEngine, disposeEngine, generate } from "./litert-engine";

export type InferenceStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

export interface InferenceProvider {
  initialize(): Promise<void>;
  interpret(
    prompt: string,
    options?: { signal?: AbortSignal; allowedActions?: string[] },
  ): Promise<string>;
  dispose(): Promise<void>;
  isReady(): boolean;
}

/** How long to wait for the worker script to even boot before giving up on it. */
const WORKER_BOOT_TIMEOUT = 15_000;

type WorkerMessage =
  | { type: "boot" }
  | { type: "status"; status: string }
  | { type: "ready" }
  | { type: "disposed" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string; fatal?: boolean };

interface Pending {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onAbort?: () => void;
  signal?: AbortSignal;
}

export class LocalLiteRTLMProvider implements InferenceProvider {
  /** Inline engine — only used when the worker path is unavailable. */
  private engine: Engine | null = null;
  private worker: Worker | null = null;
  private mode: "worker" | "inline" | null = null;

  private status: InferenceStatus = "idle";
  private lastError: string | null = null;
  private initPromise: Promise<void> | null = null;

  private nextId = 1;
  private pending = new Map<number, Pending>();
  private bootResolve: (() => void) | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;

  constructor(private readonly manifest: AIModelManifest) {}

  isReady(): boolean {
    return this.status === "ready";
  }

  getStatus(): InferenceStatus {
    return this.status;
  }

  getError(): string | null {
    return this.lastError;
  }

  /** Which path actually ran — surfaced in Settings so a fallback is visible, not hidden. */
  getMode(): "worker" | "inline" | null {
    return this.mode;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    this.status = "loading";
    this.lastError = null;

    if (await this.startWorker()) {
      this.mode = "worker";
      this.status = "ready";
      return;
    }

    try {
      this.mode = "inline";
      this.engine = await createEngine({ manifest: this.manifest });
      this.status = "ready";
    } catch (error) {
      this.status = "error";
      this.lastError = error instanceof Error ? error.message : String(error);
      this.initPromise = null;
      throw error;
    }
  }

  /* ------------------------------- worker -------------------------------- */

  private async startWorker(): Promise<boolean> {
    if (typeof Worker === "undefined") return false;

    let worker: Worker;
    try {
      worker = new Worker(new URL("./inference.worker.ts", import.meta.url), {
        type: "module",
        name: "gridhub-ai",
      });
    } catch {
      return false;
    }

    this.worker = worker;

    const booted = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), WORKER_BOOT_TIMEOUT);
      this.bootResolve = () => {
        clearTimeout(timer);
        resolve(true);
      };
    });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => this.handleWorkerMessage(event.data);
    worker.onerror = () => {
      // A script-level failure means the worker will never be usable.
      this.failWorker(new Error("The inference worker failed to start."));
    };

    if (!(await booted)) {
      this.failWorker(new Error("The inference worker did not start in time."));
      return false;
    }

    const ready = new Promise<boolean>((resolve) => {
      this.readyResolve = () => resolve(true);
      this.readyReject = () => resolve(false);
    });

    worker.postMessage({ type: "init", manifest: this.manifest });
    return ready;
  }

  private failWorker(error: Error) {
    this.bootResolve?.();
    this.bootResolve = null;
    this.readyReject?.(error);
    this.readyReject = null;
    this.readyResolve = null;

    for (const [, pending] of this.pending) pending.reject(error);
    this.pending.clear();

    try {
      this.worker?.terminate();
    } catch {
      // ignore
    }
    this.worker = null;
  }

  private handleWorkerMessage(message: WorkerMessage) {
    switch (message.type) {
      case "boot":
        this.bootResolve?.();
        this.bootResolve = null;
        break;
      case "ready":
        this.readyResolve?.();
        this.readyResolve = null;
        this.readyReject = null;
        break;
      case "error":
        if (message.fatal || message.id === undefined) {
          this.lastError = message.message;
          this.readyReject?.(new Error(message.message));
          this.readyReject = null;
          this.readyResolve = null;
          // Fatal worker errors leave the provider uninitialised so a later call can fall back.
          this.initPromise = null;
          this.status = "error";
          return;
        }
        {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.settle(message.id, pending);
          pending.reject(new Error(message.message));
        }
        break;
      case "result": {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.settle(message.id, pending);
        pending.resolve(message.text);
        break;
      }
      default:
        break;
    }
  }

  private settle(id: number, pending: Pending) {
    this.pending.delete(id);
    if (pending.onAbort && pending.signal) {
      pending.signal.removeEventListener("abort", pending.onAbort);
    }
  }

  /* ------------------------------ inference ------------------------------ */

  async interpret(
    prompt: string,
    options: { signal?: AbortSignal; allowedActions?: string[] } = {},
  ): Promise<string> {
    if (options.signal?.aborted) throw new Error("Cancelled.");
    if (this.status !== "ready") await this.initialize();

    if (this.mode === "worker" && this.worker) {
      return this.generateInWorker(prompt, options.signal);
    }
    if (this.engine) {
      return generate(this.engine, prompt, { signal: options.signal });
    }
    throw new Error("The local model is not available.");
  }

  private generateInWorker(prompt: string, signal?: AbortSignal): Promise<string> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("The inference worker is not running."));

    const id = this.nextId++;
    return new Promise<string>((resolve, reject) => {
      const pending: Pending = { resolve, reject, signal };
      pending.onAbort = () => {
        worker.postMessage({ type: "cancel", id });
        this.pending.delete(id);
        reject(new Error("Cancelled."));
      };
      signal?.addEventListener("abort", pending.onAbort, { once: true });
      this.pending.set(id, pending);
      worker.postMessage({ type: "generate", id, prompt });
    });
  }

  /* ------------------------------- teardown ------------------------------ */

  async dispose(): Promise<void> {
    const worker = this.worker;
    if (worker) {
      try {
        worker.postMessage({ type: "dispose" });
      } catch {
        // ignore
      }
      // Give the worker a moment to release the engine, then stop it regardless.
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      try {
        worker.terminate();
      } catch {
        // ignore
      }
    }
    this.worker = null;

    await disposeEngine(this.engine);
    this.engine = null;

    for (const [, pending] of this.pending) pending.reject(new Error("The model was unloaded."));
    this.pending.clear();

    this.mode = null;
    this.initPromise = null;
    this.status = "idle";
    this.lastError = null;
  }
}

/* ------------------------------- singleton ------------------------------ */

let sharedProvider: LocalLiteRTLMProvider | null = null;

export function getInferenceProvider(manifest: AIModelManifest): LocalLiteRTLMProvider {
  if (!sharedProvider) sharedProvider = new LocalLiteRTLMProvider(manifest);
  return sharedProvider;
}

export async function disposeInferenceProvider(): Promise<void> {
  if (sharedProvider) {
    await sharedProvider.dispose();
    sharedProvider = null;
  }
}
