/**
 * Gridhub AI — single loader for the vendored speech library.
 *
 * Both the installer (`stt-manager`) and the transcriber (`speech-provider`) must configure the
 * library identically. Two copies of this setup would drift, and the failure mode is ugly: the
 * installer caches files from one origin while the transcriber looks in another, and the download
 * appears to have done nothing.
 */

import { STT_LIBRARY_URL, STT_ORT_WASM_PATH } from "./model-manifest";

export interface ProgressInfo {
  status?: string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface TransformersEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  useBrowserCache: boolean;
  backends?: { onnx?: { wasm?: { wasmPaths?: unknown } } };
}

export type AsrOutput = { text?: string } | Array<{ text?: string }>;

export interface AsrPipeline {
  (audio: Float32Array, options?: Record<string, unknown>): Promise<AsrOutput>;
}

export interface TransformersModule {
  env: TransformersEnv;
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<AsrPipeline>;
}

let cached: Promise<TransformersModule> | null = null;

/**
 * Imports the vendored library.
 *
 * `new Function` keeps the bundler from trying to resolve a runtime path at build time, so the
 * library stays out of the app bundle and is only fetched when speech is actually used.
 */
async function importLibrary(): Promise<TransformersModule> {
  const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
  const mod = (await dynamicImport(STT_LIBRARY_URL)) as TransformersModule;
  if (!mod?.pipeline || !mod?.env) throw new Error("The speech library could not be loaded.");

  mod.env.allowLocalModels = false;
  mod.env.allowRemoteModels = true;
  mod.env.useBrowserCache = true;

  /*
   * A prefix, not a filename: ONNX Runtime appends the variant it needs (plain, jsep, jspi or
   * asyncify). All four are vendored, so whichever it asks for is served from our origin and can be
   * cached by the service worker.
   */
  if (mod.env.backends?.onnx?.wasm) {
    mod.env.backends.onnx.wasm.wasmPaths = STT_ORT_WASM_PATH;
  }

  return mod;
}

export function loadTransformers(): Promise<TransformersModule> {
  if (!cached) {
    cached = importLibrary().catch((error) => {
      // Do not cache a failure: a transient 404 would otherwise poison the session.
      cached = null;
      throw error;
    });
  }
  return cached;
}
