/**
 * Gridhub AI — local inference provider.
 *
 * Inference runs in a dedicated worker. A 2B model on the CPU backend would block the main thread
 * for the length of every command, freezing input and animation; the worker keeps the UI responsive
 * and lets a command be cancelled without tearing down the page.
 *
 * The model is never initialized on the main thread: a failed or blocked worker returns a clear
 * error and leaves typed deterministic commands available instead of freezing the app.
 */

import type { AIModelManifest } from "./model-manifest";

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
  private worker: Worker | null = null;
  private mode: "worker" | null = null;

  private status: InferenceStatus = "idle";
  private lastError: string | null = null;
  private initPromise: Promise<void> | null = null;

  private nextId = 1;
  private pending = new Map<number, Pending>();
  private bootResolve: (() => void) | null = null;
  private bootFail: (() => void) | null = null;
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
  getMode(): "worker" | null {
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

    try {
      if (!(await this.startWorker())) {
        throw new Error(
          "The on-device AI background worker could not start. Your app is still responsive; use a simple typed command or open the tool directly.",
        );
      }
      this.mode = "worker";
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
      this.bootFail = () => {
        clearTimeout(timer);
        resolve(false);
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

    const ready = new Promise<boolean>((resolve, reject) => {
      this.readyResolve = () => resolve(true);
      this.readyReject = (error) => reject(error);
    });

    try {
      worker.postMessage({ type: "init", manifest: this.manifest });
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new Error("The inference worker could not be initialized."));
      throw error;
    }
    try {
      return await ready;
    } catch (error) {
      // Engine initialization errors are useful diagnostics and inline initialization repeats
      // the same backend/model setup. Only use inline mode when the worker itself cannot boot.
      this.status = "error";
      this.lastError = error instanceof Error ? error.message : String(error);
      this.initPromise = null;
      throw error;
    }
  }

  private failWorker(error: Error) {
    this.bootFail?.();
    this.bootFail = null;
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
        this.bootFail = null;
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
          this.worker?.terminate();
          this.worker = null;
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
