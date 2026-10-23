/**
 * Gridhub AI — runtime pre-warm.
 *
 * Downloading the model is not enough for offline use: the WASM runtime that executes it is a
 * separate ~20–35 MB artifact, and it is fetched on first inference. If that first inference happens
 * on a plane, the model is on disk and useless.
 *
 * After a successful install we therefore pull the runtime through the service worker, which caches
 * `/ai/**` in its own cache. The two modern variants are fetched (relaxed-SIMD, with and without
 * JSPI), which covers current Chrome, Edge, Firefox and Safari. A legacy browser that needs a
 * `compat` build still downloads it on first use — that is stated in the docs rather than papered
 * over with a fourth 33 MB download nobody will use.
 */

import { LITERT_WASM_PATH } from "./model-manifest";

const JS_FILES = [
  "litertlm_wasm_internal.js",
  "litertlm_wasm_asyncify_internal.js",
  "litertlm_wasm_compat_internal.js",
  "litertlm_wasm_compat_asyncify_internal.js",
];

const WASM_FILES = ["litertlm_wasm_internal.wasm", "litertlm_wasm_asyncify_internal.wasm"];

function base(): string {
  // `LITERT_WASM_PATH` is a directory ("/ai/wasm"); tolerate a trailing slash.
  return LITERT_WASM_PATH.replace(/\/$/, "");
}

/**
 * Fetches the runtime files so the service worker caches them. Resolves even on failure: a missing
 * runtime must not fail the install, because the first command will simply fetch it again.
 */
export async function prewarmInferenceRuntime(): Promise<{ cached: number; failed: number }> {
  let cached = 0;
  let failed = 0;

  for (const file of [...JS_FILES, ...WASM_FILES]) {
    try {
      const response = await fetch(`${base()}/${file}`, { cache: "default" });
      if (response.ok) {
        // Drain the body so the browser finishes writing it to the HTTP cache even without a reader.
        await response.arrayBuffer();
        cached += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { cached, failed };
}
