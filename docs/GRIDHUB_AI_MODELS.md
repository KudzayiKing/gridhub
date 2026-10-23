# Gridhub AI — Models, Assets and Offline Behaviour

Two artifacts are involved, and they are independent:

| Artifact | Size | Where it lives | Needed for |
| --- | --- | --- | --- |
| Language model (`.litertlm`) | **1.87 GiB** (2,008,432,640 bytes) | Cache API `gridhub-ai-models-v1` | Understanding free-form commands |
| Speech model (Whisper tiny, q8) | ~40 MB across 6–7 files | Cache API `transformers-cache` | Voice input |

Text commands work with neither installed. Deterministic commands (navigation, four read-only
questions) work with neither installed.

---

## 1. Language model

Default URL, overridable with `NEXT_PUBLIC_GRIDHUB_AI_MODEL_URL`:

```
https://pub-610daaff40ac42f18aa2de55bc3970b2.r2.dev/models/gemma-4-E2B-it-web.litertlm
```

The size above was **measured** from the deployed object (`Content-Length`) on 2026-10-23, not
estimated.

### Integrity

`sha256` is deliberately unset in `lib/ai/model-manifest.ts`. R2 returns a multipart ETag, which is
not a SHA-256 and cannot be used as one. The downloader therefore *computes* the hash while streaming
and records it on install; `integrity` reads `"computed"`.

To turn that into verification:

1. Compute the hash once against the deployed object.
2. Set `sha256` in `AI_MODEL`.
3. Reinstall — `integrity` becomes `"verified"` and a mismatched download is deleted, not cached.

### Storage choice

The model is stored in the **Cache API**, not IndexedDB. Customer records live in IndexedDB; putting
a multi-gigabyte artifact in the same database would make it a candidate for eviction alongside real
data, and would slow every record query. `navigator.storage.persist()` is requested before writing.

### Install flow

`Download AI` → `downloadModel()`:

1. `cache: "no-store"` fetch of the R2 URL.
2. Body read chunk by chunk; each chunk is hashed and pushed straight into a `ReadableStream` that
   becomes the cache entry. The file is never buffered in memory.
3. Progress reports real received bytes; the percentage appears only when the server sent a
   `Content-Length`.
4. Incomplete downloads are rejected and the partial cache entry is deleted.
5. `sha256` is checked when the manifest has one.
6. The WASM runtime is pre-warmed in the background (see §3).

`Not now` dismisses the prompt without downloading. `Remove from this device` deletes the cache entry,
clears the metadata and disposes the engine.

## 2. Speech model

Installed separately, because someone may want to type and never speak. `stt-manager.ts` drives
Transformers.js itself to perform the download, so the cache keys are exactly the ones the pipeline
will look for later. Files land in `transformers-cache`.

Installed-state is `meta exists AND cache still contains files for this model`. The second half
matters: browsers evict caches under pressure, and a stale flag would send the user into a download
that looks like a hang.

Default model is **multilingual** `Xenova/whisper-tiny`, not `.en`: Settings offers French, Spanish,
German and Portuguese, and an English-only checkpoint would transcribe those as gibberish.

## 3. Self-hosted runtime assets (why offline works)

Both runtimes used to be loaded from jsDelivr. That made "installed, works offline" false on a cold
start: the model was cached, but the code that executes it was not.

`scripts/vendor-ai-assets.mjs` copies/downloads them into `public/ai/`:

| Path | Contents | Size |
| --- | --- | --- |
| `public/ai/wasm/` | LiteRT-LM runtime (4 variants: plain / compat × jspi / asyncify) | ~143 MB |
| `public/ai/transformers/` | Transformers.js 4.3.1 | 572 KB |
| `public/ai/ort/` | ONNX Runtime 1.30.0 WASM (4 variants + loaders) | ~82 MB |

The directory is **generated and git-ignored**. `predev` and `prebuild` run the script, so a fresh
clone and a CI build both get the assets with no manual step.

```bash
npm run vendor:ai            # skip files that already exist
npm run vendor:ai -- --force # re-download after a version bump
```

### Caching

`public/sw.js` treats `/ai/**` as immutable:

- Own cache: `gridhub-v1-ai-runtime-v1`, cache-first, no revalidation.
- Bumping `AI_RUNTIME_VERSION` retires the old generation; the activate handler deletes caches from
  earlier generations so a version bump cannot leak ~230 MB forever.

### Pre-warm

`runtime-prefetch.ts` fetches the four `.js` files and the two modern `.wasm` variants right after a
successful model install, so the runtime is in the cache before the user goes offline.

**Caveat, stated rather than hidden:** a browser that needs a `compat` WASM build will fetch it on
first use. That is one online run, not a permanent requirement.

## 4. What "offline" actually means

| Scenario | Works offline? |
| --- | --- |
| Typed command, model installed, runtime pre-warmed | Yes |
| Voice command, both models installed | Yes |
| Deterministic command (navigation, unpaid invoices…) | Yes, with nothing installed |
| First run ever, no network | No — nothing is downloaded |
| Legacy browser needing `compat` WASM, never ran online | No — fetched on first use |
| Model evicted by the browser under storage pressure | No — reinstall prompt appears |

Writes made offline go into the existing outbox and sync when the connection returns. The UI labels
them "Local · will sync when you're online".

## 5. Version bumps

When upgrading `@litert-lm/core`, `@huggingface/transformers` or `onnxruntime-web`:

1. Update the pinned versions in `scripts/vendor-ai-assets.mjs`.
2. Run `npm run vendor:ai -- --force`.
3. Bump `AI_RUNTIME_VERSION` in `public/sw.js`.
4. Bump `NEXT_PUBLIC_GRIDHUB_AI_MODEL_VERSION` if the model file changed, so installed clients are
   asked to download again.
