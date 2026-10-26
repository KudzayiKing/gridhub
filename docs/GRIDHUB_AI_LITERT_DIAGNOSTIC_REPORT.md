# GridHub AI LiteRT-LM diagnostic report

**Date:** 2026-10-26
**Scope:** Existing browser LiteRT-LM and speech paths. No runtime migration or model preprocessing changes.

## Findings

### Runtime and artifacts

- LiteRT-LM package: `@litert-lm/core` **0.18.0** (the lockfile resolves 0.18.0; package range is `^0.18.0`).
- Text model: **Gemma 4 E2B Instruct web build**, ID `gemma-4-e2b-it-web`, version `1`.
- Artifact: `gemma-4-E2B-it-web.litertlm` from GridHub's Cloudflare R2 bucket.
- Size: **2,008,432,640 bytes** (about 1.87 GiB). Expected SHA-256: `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`.
- The expected hash was previously checked against the R2 copy and the source artifact. A HEAD request during this investigation returned HTTP 200 and the same content length. That confirms the object is present and advertises the expected size; it does not benchmark a full download.
- Google’s model card describes the LiteRT-LM **Web** build as text-only. The generic Gemma 4 E2B family supports audio, but that does not mean this web artifact does.

### Audio path and mel warning

- GridHub does **not** send microphone bytes to Gemma. `MediaRecorder` captures audio, Web Audio decodes/resamples it to mono 16 kHz, and Transformers.js runs `Xenova/whisper-tiny` locally. Only the transcript string is sent to LiteRT-LM.
- The 257-point FFT / 128-band warning is emitted by LiteRT's Gemma 4 audio data processor (`mel_filterbank.cc`), not Whisper. The matching LiteRT-LM issue maintainer says that warning is expected for Gemma 4 and is not itself the cause of the reported crash. It can be logged while the runtime prepares Gemma 4's audio metadata; it does **not** prove that GridHub passed raw audio into Gemma.
- Issue #3260 uses LiteRT-LM JVM 0.16.0 and a CPU backend, so it is not a direct reproduction of GridHub's JS 0.18.0 WebGPU setup. Issue #1848 is a Python CPU multimodal configuration failure; its author later resolved it by configuring the CPU audio and vision backends. Neither issue justifies changing GridHub's trained FFT or mel parameters.
- Whisper's input is resampled to mono 16 kHz and called with 30-second chunks. The pinned model's published feature config uses 16 kHz, 80 mel features, `n_fft=400`, and `hop_length=160`; that matches this separate Whisper path. No FFT or mel parameters were changed.

### Accelerator and responsiveness

- Current LiteRT-LM JS code omits the backend argument. In `@litert-lm/core` 0.18.0 that selects `GPU_ARTISAN`, the WebGPU streaming backend. GridHub additionally requires `navigator.gpu` before creating the engine.
- “GPU WebGPU registered” and “XNNPACK CPU accelerator registered” report available/registered accelerators; they do not establish which one ran the command. The NPU `NotFound` warning is expected on a Mac without a LiteRT-supported NPU and does not explain a WebGPU inference failure.
- Before this change, a worker boot failure could fall back to initializing the 2 GB model on the browser main thread. That could make the whole page appear stuck. The main-thread fallback is now removed: a worker startup failure is shown clearly and simple typed commands remain usable.
- The installed provider is shared per browser JavaScript realm and has an initialization promise; the worker retains one engine, deletes each conversation after a command, and serializes execution through LiteRT's engine mutex. Different tabs still have independent model instances.
- Whisper is a separate singleton pipeline. Installation used to create a temporary ONNX pipeline and drop the reference without disposing it, potentially retaining an extra session. The installer now disposes that pipeline, and removing Whisper explicitly releases the live pipeline.

### Storage and repeat-download risk

- The Gemma file is in Cache API cache `gridhub-ai-models-v1`; its metadata is stored separately in localStorage. The worker runtime is cached separately by service worker under the versioned `ai-runtime-v2` cache. Whisper uses Transformers.js's `transformers-cache`.
- Previously, model readiness trusted localStorage alone. If the browser evicted the 2 GB Cache API entry, engine creation silently used the R2 URL and fetched the whole model again outside GridHub's download/hash-verification path. This is a credible source of very long startup and repeat loading.
- Model readiness now checks that the cached object still exists and matches recorded size/manifest metadata. Engine creation now refuses to silently fetch a missing 2 GB artifact; the user is prompted to reinstall it. Completed downloads continue to be checked against the pinned SHA-256.

## Timings and test status

The local project build and TypeScript check pass. The R2 HEAD check completed successfully, but no full 2 GB download was run.

Actual MacBook inference timings are **not yet measured**: the current browser session did not have GridHub open, and no live model/audio run was performed. In particular, this report cannot truthfully fill in this user's model download time, model initialization time, Whisper transcription time, prefill, time-to-first-token, total inference, or action-save time. The user has previously reported MacBook + Chrome and Chrome's “WebGPU: Hardware accelerated” indicator; exact Mac model, Chrome version, and adapter are unknown.

The app now emits local-only, content-free console records with prefix `[GridHub AI diagnostics]` for:

- verified model download time, bytes, and integrity;
- LiteRT runtime load, model cache lookup, engine creation, configured backend, browser/platform, cores, and reported device memory;
- Gemma first text chunk, total inference time, LiteRT prefill/decode token rates and counts, and runtime TTFT;
- Whisper pipeline initialization, audio decode, transcription, and total transcription time;
- command routing, action preparation, and confirmed action commit.

These records do not include the prompt, transcript, audio, or generated response. If the model cache is missing, `Engine.create` is now stopped instead of mixing a hidden download into its initialization timing.

**Independent inference tests:** source inspection confirms typed text is routed without speech and speech transcription is a separate provider; a true Gemma-only inference and Whisper-only transcription smoke run still require a browser session with the installed artifacts and microphone permission. Those runtime tests were not performed in this investigation.

## Safe fallback added

- Typed commands `Add $40 for groceries`, `Add $40 to groceries`, and `Spent 12.50 on coffee` now have a narrow deterministic parser path, avoiding model latency for those simple entries.
- The parser still goes through existing entitlement checks, action validation, and the same confirmation card. It never writes a record directly.
- On microphone, model, or worker errors, the composer remains available; the UI points users to simple typed commands or manual entry.
- Browsers without WebGPU no longer offer a futile 2 GB model download for this web build.

## Most likely bottleneck

The strongest confirmed latency risk is loading and initializing the **2.008 GB model**, especially if its browser cache was evicted: the old readiness check could mistake stale metadata for a cached model and silently start another R2 fetch. A second risk is a failed worker path falling back to main-thread initialization, which can look like a frozen application. Both are addressed in source now.

After deployment, a browser run is still needed to determine whether the remaining wait is dominated by model transfer/cache read, GPU engine initialization, Whisper initialization/transcription, Gemma prefill/decode, or action persistence. The new diagnostic records make those phases separable without changing model preprocessing.

## References

- [LiteRT-LM issue #3260](https://github.com/google-ai-edge/LiteRT-LM/issues/3260) — same mel warning; maintainer says expected for Gemma 4 and unrelated to the issue's crash.
- [LiteRT-LM issue #1848](https://github.com/google-ai-edge/LiteRT-LM/issues/1848) — CPU multimodal initialization configuration report; later resolved by its author with explicit audio/vision CPU backends.
- [Gemma 4 E2B LiteRT-LM model card](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) — Web build benchmark and text-only limitation.
- [LiteRT-LM JavaScript package README](https://github.com/google-ai-edge/LiteRT-LM/blob/main/js/packages/core/README.md) — supported web model artifacts, WebGPU backend, and streaming interface.
- [Transformers.js pipeline API](https://huggingface.co/docs/transformers.js/api/pipelines) — pipeline lifecycle and `dispose()`.
- [Xenova Whisper Tiny preprocessor config](https://huggingface.co/Xenova/whisper-tiny/blob/main/preprocessor_config.json) — sample rate and Whisper feature-extractor parameters.
