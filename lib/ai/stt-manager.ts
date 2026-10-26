/**
 * Gridhub AI — speech model installation.
 *
 * The speech model is installed explicitly, like the language model. Without this the first voice
 * command silently downloaded ~40 MB from Hugging Face and the panel looked frozen; now the same
 * download has a progress bar, a cancel button and a stored record of what is on the device.
 *
 * Files are written by Transformers.js itself into its own cache (`transformers-cache`), so the
 * cache keys are guaranteed to match what the pipeline looks for later. Hand-rolling the URLs would
 * be faster to write and would silently miss a file the moment the library changed its layout.
 */

import { STT_MODEL, STT_MODEL_VERSION } from "./model-manifest";
import { loadTransformers, type ProgressInfo } from "./transformers-loader";

const META_KEY = "gridhub.ai.stt.meta";
const TRANSFORMERS_CACHE = "transformers-cache";

export interface SpeechModelMeta {
  model: string;
  version: string;
  installedAt: string;
  /** Number of cached files attributed to this model. */
  files: number;
}

export interface SpeechProgress {
  /** Current file being fetched, e.g. "onnx/encoder_model_quantized.onnx". */
  file: string;
  /** 0–100 for the current file. */
  fileProgress: number;
  loaded?: number;
  total?: number;
  /** How many files have completed so far. */
  completed: number;
}

export function readSpeechMeta(): SpeechModelMeta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SpeechModelMeta) : null;
  } catch {
    return null;
  }
}

function writeSpeechMeta(meta: SpeechModelMeta | null) {
  if (typeof localStorage === "undefined") return;
  if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
  else localStorage.removeItem(META_KEY);
}

function cacheAvailable(): boolean {
  return typeof caches !== "undefined";
}

/** Cache keys belonging to the configured speech model. */
async function modelCacheKeys(): Promise<Request[]> {
  if (!cacheAvailable()) return [];
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE);
    const keys = await cache.keys();
    return keys.filter((request) => request.url.includes(STT_MODEL));
  } catch {
    return [];
  }
}

/**
 * Installed means: we recorded a successful install AND the cache still holds files for the model.
 * The second half matters because browsers evict caches under pressure, and a stale flag would send
 * the user into a download that looks like a hang.
 */
export async function isSpeechModelInstalled(): Promise<boolean> {
  const meta = readSpeechMeta();
  if (!meta || meta.model !== STT_MODEL || meta.version !== STT_MODEL_VERSION) return false;
  const keys = await modelCacheKeys();
  return keys.length > 0;
}

export async function removeSpeechModel(): Promise<void> {
  if (cacheAvailable()) {
    try {
      const cache = await caches.open(TRANSFORMERS_CACHE);
      const keys = await modelCacheKeys();
      await Promise.all(keys.map((key) => cache.delete(key)));
    } catch {
      // Best effort: the meta record is cleared either way.
    }
  }
  writeSpeechMeta(null);
}

/**
 * Downloads and caches the speech model.
 *
 * Cancellation stops the wait and clears the record; a fetch already in flight may still finish in
 * the background, which is harmless — those bytes are the cache we wanted anyway.
 */
export async function installSpeechModel(options: {
  onProgress?: (progress: SpeechProgress) => void;
  signal?: AbortSignal;
} = {}): Promise<SpeechModelMeta> {
  const mod = await loadTransformers();
  if (options.signal?.aborted) throw new Error("Cancelled.");

  const completed = new Set<string>();

  const progressCallback = (info: ProgressInfo) => {
    const file = info.file ?? info.name ?? "model";
    if (info.status === "done") completed.add(file);
    options.onProgress?.({
      file,
      fileProgress: typeof info.progress === "number" ? info.progress : 0,
      loaded: info.loaded,
      total: info.total,
      completed: completed.size,
    });
  };

  // Instantiating the pipeline downloads and prepares the model. Dispose the temporary ONNX
  // session after caching so installation does not leave a second in-memory Whisper instance.
  const pipeline = await mod.pipeline("automatic-speech-recognition", STT_MODEL, {
    dtype: "q8",
    progress_callback: progressCallback,
  });
  await pipeline.dispose?.();

  if (options.signal?.aborted) throw new Error("Cancelled.");

  const keys = await modelCacheKeys();
  const meta: SpeechModelMeta = {
    model: STT_MODEL,
    version: STT_MODEL_VERSION,
    installedAt: new Date().toISOString(),
    files: keys.length,
  };
  writeSpeechMeta(meta);
  return meta;
}
