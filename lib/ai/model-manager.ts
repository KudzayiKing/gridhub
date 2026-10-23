/**
 * Gridhub AI — local model storage.
 *
 * The model lives in the Cache API, not in IndexedDB alongside customer records, so a
 * multi-gigabyte artifact can never be mixed with, or evicted together with, user data. Metadata
 * is a small localStorage entry. Nothing here performs inference.
 */

import { Sha256 } from "./sha256";
import type { AIModelManifest } from "./model-manifest";

const CACHE_NAME = "gridhub-ai-models-v1";
const META_KEY = "gridhub.ai.model.meta";

export interface InstalledModelMeta {
  id: string;
  version: string;
  sourceUrl: string;
  bytes: number;
  sha256: string;
  installedAt: string;
  /** "verified" when checked against a known hash, "computed" when only recorded. */
  integrity: "verified" | "computed";
}

export interface DownloadProgress {
  received: number;
  total: number;
  /** 0–1, or undefined when the server did not provide a size. */
  ratio?: number;
}

function cacheSupported(): boolean {
  return typeof caches !== "undefined";
}

export function readModelMeta(): InstalledModelMeta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as InstalledModelMeta) : null;
  } catch {
    return null;
  }
}

function writeModelMeta(meta: InstalledModelMeta | null) {
  if (typeof localStorage === "undefined") return;
  if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
  else localStorage.removeItem(META_KEY);
}

export function isModelInstalled(manifest: AIModelManifest): boolean {
  const meta = readModelMeta();
  return Boolean(meta && meta.id === manifest.id && meta.version === manifest.version);
}

/** Ask the browser not to evict the cached model. Best-effort and safe to call repeatedly. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore: persistence is a hint, not a guarantee.
  }
  return false;
}

export async function getModelBlob(manifest: AIModelManifest): Promise<Blob | null> {
  if (!cacheSupported()) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(manifest.sourceUrl);
  if (!response) return null;
  return response.blob();
}

export async function removeModel(manifest: AIModelManifest): Promise<void> {
  if (cacheSupported()) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(manifest.sourceUrl);
  }
  const meta = readModelMeta();
  if (!meta || meta.id === manifest.id) writeModelMeta(null);
}

/**
 * Streams the model into the cache while hashing and reporting real progress.
 *
 * The bytes are never buffered in memory: the response body is read chunk by chunk, each chunk is
 * fed to the streaming hash and pushed straight into the cache entry. Cancellation aborts the
 * fetch and drops any partial entry.
 */
export async function downloadModel(
  manifest: AIModelManifest,
  options: {
    signal?: AbortSignal;
    onProgress?: (p: DownloadProgress) => void;
  } = {},
): Promise<InstalledModelMeta> {
  if (!cacheSupported()) {
    throw new Error("This browser cannot cache the model offline (Cache API unavailable).");
  }

  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(manifest.sourceUrl, {
    signal: options.signal,
    // Model files are immutable and versioned by URL.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Model download failed (HTTP ${response.status}).`);
  }
  if (!response.body) {
    throw new Error("The model response had no body.");
  }

  const headerLength = Number(response.headers.get("content-length")) || 0;
  const total = headerLength || manifest.sizeBytes || 0;
  const hasher = new Sha256();
  const reader = response.body.getReader();
  let received = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            hasher.update(value);
            received += value.byteLength;
            options.onProgress?.({
              received,
              total,
              ratio: total > 0 ? received / total : undefined,
            });
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  try {
    await cache.put(
      manifest.sourceUrl,
      new Response(stream, {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(total || received),
        },
      }),
    );
  } catch (error) {
    await cache.delete(manifest.sourceUrl);
    throw error instanceof Error ? error : new Error("Model download was interrupted.");
  }

  if (total > 0 && received !== total) {
    await cache.delete(manifest.sourceUrl);
    throw new Error(
      `Model download was incomplete (${received} of ${total} bytes). Please try again.`,
    );
  }

  const digest = hasher.hex();

  if (manifest.sha256) {
    if (digest.toLowerCase() !== manifest.sha256.toLowerCase()) {
      await cache.delete(manifest.sourceUrl);
      throw new Error("The downloaded model failed its integrity check.");
    }
  }

  const meta: InstalledModelMeta = {
    id: manifest.id,
    version: manifest.version,
    sourceUrl: manifest.sourceUrl,
    bytes: received,
    sha256: digest,
    installedAt: new Date().toISOString(),
    integrity: manifest.sha256 ? "verified" : "computed",
  };
  writeModelMeta(meta);
  return meta;
}
