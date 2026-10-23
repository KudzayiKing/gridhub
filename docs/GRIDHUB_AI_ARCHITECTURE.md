# Gridhub AI — Architecture

Gridhub AI is an on-device assistant. It runs a local language model in the browser, turns a spoken
or typed command into one of a fixed set of app actions, and shows that action for confirmation
before anything is written.

There is no cloud LLM, no API key, and no hosted inference endpoint. Cloudflare R2 is used only to
distribute the model file.

---

## 1. The pipeline

```
voice ──► local Whisper ──┐
                          ├──► command router ──► deterministic parser (navigation, 4 read-only shortcuts)
text ─────────────────────┘                   └──► local model (LiteRT-LM, in a worker)
                                                        │
                                                        ▼
                                            JSON proposal (validated)
                                                        │
                          ┌─────────────────────────────┴──────────────────────────┐
                          ▼                                                        ▼
             action allowlist + Zod schema                            read-only query
                          │                                                        │
                          ▼                                                        ▼
              entitlement check (plan/tools)                            app calc services
                          │                                                        │
                          ▼                                                        ▼
             entity resolution (may ask a question)                        answer to the user
                          │
                          ▼
              confirmation card (user presses Confirm)
                          │
                          ▼
        createRecord / updateRecord  ──►  IndexedDB  ──►  existing outbox  ──►  Supabase
```

Every arrow above is a real module boundary. The model never writes; it only proposes.

## 2. Modules

| File | Responsibility |
| --- | --- |
| `lib/ai/model-manifest.ts` | Model identity, URLs, device capability detection |
| `lib/ai/model-manager.ts` | Cache API storage, streaming download, progress, integrity |
| `lib/ai/sha256.ts` | Incremental SHA-256 (Web Crypto cannot hash a stream) |
| `lib/ai/action-schemas.ts` | 28 Zod schemas — the only shapes an action may take |
| `lib/ai/action-registry.ts` | The allowlist: ids, tool, kind, confirmation requirement |
| `lib/ai/permission-checker.ts` | Server entitlement, plan cap, local fallback |
| `lib/ai/entity-resolver.ts` | Name / date / period resolution |
| `lib/ai/deterministic-parser.ts` | Navigation and exact read-only commands, no model |
| `lib/ai/context-builder.ts` | Builds the prompt; sends action list + record *names* only |
| `lib/ai/action-validator.ts` | Rejects anything that is not a known, well-formed action |
| `lib/ai/action-executor.ts` | Prepares and commits actions, idempotency, undo |
| `lib/ai/command-router.ts` | Deterministic-first routing, then the model |
| `lib/ai/litert-engine.ts` | Engine lifecycle + one-shot generation (worker-safe) |
| `lib/ai/inference.worker.ts` | Runs the model off the main thread |
| `lib/ai/inference-provider.ts` | Worker client with inline fallback |
| `lib/ai/transformers-loader.ts` | Single, configured loader for the speech library |
| `lib/ai/speech-provider.ts` | Microphone capture, resampling, local transcription |
| `lib/ai/stt-manager.ts` | Speech model install / verify / remove |
| `lib/ai/runtime-prefetch.ts` | Caches the WASM runtime after a model install |
| `lib/ai/ai-privacy.ts` | Local history, retention, privacy copy |

## 3. Why inference runs in a worker

A 2B model on the CPU backend blocks the thread that paints. Running it on the main thread froze
input, scrolling and icon animation for the whole duration of a command, and made "Stop" unusable —
the button could not repaint to be clicked.

`inference.worker.ts` owns exactly one engine and one in-flight conversation. The protocol is small:

```
main → worker   { type: "init", manifest }
                { type: "generate", id, prompt }
                { type: "cancel", id }
                { type: "dispose" }

worker → main   { type: "boot" } | { type: "status", status } | { type: "ready" }
                { type: "result", id, text } | { type: "error", id?, message, fatal? }
```

`boot` exists so the main thread can tell "the worker never loaded" (fall back inline) from "the
model is still loading" (keep waiting). Only boot has a timeout; loading 1.87 GB from the cache has
none, because a fixed timeout would fail on a slow device and succeed on a fast one.

**Fallback.** If `Worker` is unavailable, module workers are blocked, or the worker errors during
startup, the identical engine code runs inline via `litert-engine.ts`. Both paths share that module,
so behaviour cannot drift; only the thread differs.

## 4. Safety model

The threat is not a malicious user — it is a model that hallucinates, or content that talks it into
something. Four independent gates:

1. **Allowlist.** `actionId` must exist in `REGISTERED_ACTIONS`. Invented ids are rejected before
   any domain code is reached.
2. **Schema.** Parameters are parsed by that action's Zod schema. Unknown fields are dropped, wrong
   types fail, negative amounts fail.
3. **Kind check.** A `query` action cannot be executed as a write, and a write cannot be smuggled
   through the query path.
4. **Entitlement.** `canUseTool` re-checks the plan at execution time, not just at prompt time, so a
   stale prompt or a replayed proposal cannot reach a tool the account does not have.

Model output is never evaluated. It is parsed as JSON, validated, and mapped to a registered action.
Navigation is constrained to paths starting with `/app`.

## 5. Idempotency and undo

Each prepared action carries a mutation key. `claimMutation` writes it to a local ledger with a 24 h
TTL before the write, so a double-tap, a reconnect, or a reload cannot create the record twice. On
failure the claim is released, so a retry is possible. Writes that can be reversed expose `undo`,
which removes the record through the same repository (and therefore the same sync path).

## 6. Confirmation

Every write is a proposal with a summary of what will happen — tool, description, amount, date,
resolved entity. Nothing is committed until the user presses Confirm. Queries are read-only and need
no confirmation.

## 7. Known limits

- Inference has not been executed on a real device in this repository's history. The code paths are
  complete and type-checked; they are not benchmarked.
- The prompt relies on the model returning JSON. There is no grammar-constrained decoding yet, so a
  malformed reply is rejected (and reported as a clarification) rather than repaired.
- Legacy browsers needing a `compat` WASM build fetch it on first use rather than at install.
