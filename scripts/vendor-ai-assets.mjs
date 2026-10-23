#!/usr/bin/env node
/**
 * Vendors the AI runtime assets into `public/ai/` so nothing is fetched from a CDN at runtime.
 *
 * Why this exists: the LiteRT-LM WASM runtime and the speech (Transformers.js + ONNX Runtime) assets
 * used to be pulled from jsDelivr. That made "installed and works offline" false on a cold start —
 * the 1.87 GB model was cached, but the code that runs it was not. Serving them from our own origin
 * lets the service worker cache them and removes a third-party dependency from the critical path.
 *
 * The output directory is generated, not committed (see .gitignore). `predev` and `prebuild` run this
 * script so a fresh clone and a CI build both get the assets without a manual step.
 *
 * Usage:
 *   node scripts/vendor-ai-assets.mjs           # skip files that already exist
 *   node scripts/vendor-ai-assets.mjs --force   # re-download everything
 */

import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "ai");
const FORCE = process.argv.includes("--force");

/** Versions are pinned. They must match what the app expects at runtime. */
const TRANSFORMERS_VERSION = "4.3.1";
const ORT_VERSION = "1.30.0";

const ORT_FILES = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jspi.wasm",
  "ort-wasm-simd-threaded.jspi.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
];

async function exists(path) {
  try {
    const info = await stat(path);
    return info.size > 0;
  } catch {
    return false;
  }
}

function human(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

async function download(url, destination, label) {
  if (!FORCE && (await exists(destination))) {
    process.stdout.write(`  = ${label} (already present)\n`);
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`${label}: HTTP ${response.status} from ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  const { size } = await stat(destination);
  process.stdout.write(`  + ${label} (${human(size)})\n`);
}

async function copyLiteRtWasm() {
  const source = join(ROOT, "node_modules", "@litert-lm", "core", "wasm");
  let entries;
  try {
    const { readdir } = await import("node:fs/promises");
    entries = await readdir(source);
  } catch {
    console.warn(
      "  ! @litert-lm/core/wasm not found. Run `npm install` first; skipping the LiteRT runtime.",
    );
    return;
  }

  const wanted = entries.filter((name) => name.endsWith(".js") || name.endsWith(".wasm"));
  for (const name of wanted) {
    const destination = join(OUT, "wasm", name);
    if (!FORCE && (await exists(destination))) {
      process.stdout.write(`  = wasm/${name} (already present)\n`);
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(join(source, name)));
    const { size } = await stat(destination);
    process.stdout.write(`  + wasm/${name} (${human(size)})\n`);
  }
}

async function main() {
  console.log(`Vendoring AI assets into ${OUT}`);

  console.log("\nLiteRT-LM runtime (same origin, cacheable by the service worker):");
  await copyLiteRtWasm();

  console.log(`\nTransformers.js ${TRANSFORMERS_VERSION}:`);
  await download(
    `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/transformers.min.js`,
    join(OUT, "transformers", "transformers.min.js"),
    "transformers/transformers.min.js",
  );

  console.log(`\nONNX Runtime ${ORT_VERSION} (used by the speech pipeline):`);
  for (const file of ORT_FILES) {
    await download(
      `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/${file}`,
      join(OUT, "ort", file),
      `ort/${file}`,
    );
  }

  console.log("\nDone. Nothing in the AI runtime is fetched from a third party at runtime.");
}

main().catch((error) => {
  console.error(`\nVendoring failed: ${error.message}`);
  /*
   * Deliberately does NOT wipe public/ai. A transient network error must not destroy a working
   * tree; every file is written whole and re-checked for a non-zero size on the next run, so the
   * worst case is one missing asset that the next `predev`/`prebuild` fills in.
   */
  process.exit(1);
});
