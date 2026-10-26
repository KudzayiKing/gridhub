/**
 * Gridhub AI — model configuration, manifest and device compatibility.
 *
 * Everything here is local-first: the model is fetched once from Cloudflare R2 and cached on the
 * device. Nothing in this module sends commands, audio or records anywhere.
 */

export type AICompatibilityLevel = "full" | "text" | "basic" | "unavailable";

export interface AIModelManifest {
  id: string;
  name: string;
  version: string;
  sourceUrl: string;
  format: string;
  /** Measured from the real artifact. Left unset until it is known — never invented. */
  sizeBytes?: number;
  /** Measured from the real artifact. When present the downloader verifies it. */
  sha256?: string;
  minimumRequirements?: {
    webgpu?: boolean;
    estimatedMemoryBytes?: number;
  };
}

const ENV = {
  enabled: process.env.NEXT_PUBLIC_GRIDHUB_AI_ENABLED,
  modelUrl: process.env.NEXT_PUBLIC_GRIDHUB_AI_MODEL_URL,
  modelVersion: process.env.NEXT_PUBLIC_GRIDHUB_AI_MODEL_VERSION,
  sttModel: process.env.NEXT_PUBLIC_GRIDHUB_STT_MODEL_URL,
  sttVersion: process.env.NEXT_PUBLIC_GRIDHUB_STT_MODEL_VERSION,
  locale: process.env.NEXT_PUBLIC_GRIDHUB_AI_DEFAULT_LOCALE,
  wasmPath: process.env.NEXT_PUBLIC_GRIDHUB_AI_WASM_PATH,
  sttLibraryUrl: process.env.NEXT_PUBLIC_GRIDHUB_STT_LIBRARY_URL,
};

export const AI_ENABLED = ENV.enabled !== "false";

/**
 * The web-compatible Gemma build hosted on the owner's R2 bucket. This is the only default URL;
 * it is overridable with NEXT_PUBLIC_GRIDHUB_AI_MODEL_URL so a different artifact can be shipped
 * without a code change.
 */
export const DEFAULT_MODEL_URL =
  "https://pub-610daaff40ac42f18aa2de55bc3970b2.r2.dev/models/gemma-4-E2B-it-web.litertlm";

export const AI_MODEL: AIModelManifest = {
  id: "gemma-4-e2b-it-web",
  name: "Gemma 4 E2B Instruct (web)",
  version: ENV.modelVersion || "1",
  sourceUrl: ENV.modelUrl || DEFAULT_MODEL_URL,
  format: "litertlm",
  /*
   * Measured from the deployed artifact on 2026-10-23: `Content-Length: 2008432640` (1.87 GiB).
   * This is a real measurement, not an estimate, and it is what the download UI shows.
   *
   * Verified against the original Hugging Face artifact and the deployed R2 copy on 2026-10-26.
   * The downloader checks this hash before marking an install verified.
   */
  sizeBytes: 2_008_432_640,
  sha256: "3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5",
  minimumRequirements: { webgpu: true },
};

/**
 * Local speech model (Transformers.js repo id). Optional: text commands work without it.
 *
 * Multilingual rather than `.en`: the settings page offers French, Spanish, German and Portuguese,
 * and an English-only checkpoint would silently transcribe those as gibberish. The cost is a few
 * megabytes, not an order of magnitude.
 */
export const STT_MODEL = ENV.sttModel || "Xenova/whisper-tiny";
export const STT_MODEL_VERSION = ENV.sttVersion || "1";

/**
 * Library code for on-device STT, served from our own origin.
 *
 * It used to be a jsDelivr URL. That made "installed and works offline" untrue on a cold start: the
 * model was cached but the code that runs it was not. `scripts/vendor-ai-assets.mjs` copies it into
 * `public/ai/` before dev and build.
 */
export const STT_LIBRARY_URL =
  ENV.sttLibraryUrl || "/ai/transformers/transformers.min.js";

/** ONNX Runtime WASM prefix, also same-origin. All four variants are vendored. */
export const STT_ORT_WASM_PATH = process.env.NEXT_PUBLIC_GRIDHUB_STT_ORT_PATH || "/ai/ort/";

/**
 * LiteRT-LM WASM directory, served from our own origin so the service worker can cache it.
 * Undefined would fall back to the package's jsDelivr default, which breaks offline.
 */
export const LITERT_WASM_PATH = ENV.wasmPath || "/ai/wasm";

export const AI_LOCALE = ENV.locale || "en";

export interface AICapabilities {
  wasm: boolean;
  webgpu: boolean;
  microphone: boolean;
  mediaRecorder: boolean;
  storage: { supported: boolean; quota?: number; usage?: number };
  level: AICompatibilityLevel;
  reasons: string[];
}

/**
 * Detects what this browser can actually do. Feature detection only — no user-agent sniffing,
 * which is unreliable and would misclassify devices.
 */
export async function detectCapabilities(): Promise<AICapabilities> {
  const reasons: string[] = [];
  const wasm = typeof WebAssembly === "object";
  const webgpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const microphone =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const mediaRecorder = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

  let quota: number | undefined;
  let usage: number | undefined;
  let storageSupported = false;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      quota = est.quota;
      usage = est.usage;
      storageSupported = true;
    }
  } catch {
    // Storage estimates are best-effort.
  }

  if (!wasm) reasons.push("WebAssembly is unavailable, so the local model cannot run.");
  if (!microphone) reasons.push("Microphone capture is unavailable in this browser.");
  if (!mediaRecorder) reasons.push("MediaRecorder is unavailable, so voice input is disabled.");
  if (!webgpu) reasons.push("WebGPU is unavailable; this web model cannot run in this browser. Simple typed commands and manual tools remain available.");

  let level: AICompatibilityLevel;
  if (!wasm || !webgpu) level = "basic";
  else if (microphone && mediaRecorder) level = "full";
  else level = "text";

  return {
    wasm,
    webgpu,
    microphone,
    mediaRecorder,
    storage: { supported: storageSupported, quota, usage },
    level,
    reasons,
  };
}

/** Human-readable download size. Unknown sizes say so rather than showing a fake number. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Size unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
