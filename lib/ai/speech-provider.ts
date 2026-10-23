/**
 * Gridhub AI — on-device speech-to-text.
 *
 * Audio is captured only after an explicit tap, decoded and transcribed locally, and never
 * uploaded. If the runtime or model is unavailable the provider reports it and the UI falls back
 * to typing — it never silently substitutes a cloud service.
 */

import { STT_MODEL } from "./model-manifest";
import { loadTransformers, type AsrPipeline } from "./transformers-loader";

export interface SpeechProvider {
  isSupported(): boolean;
  start(): Promise<void>;
  /** Resolves once the recorder has flushed its final chunk. */
  stop(): Promise<Blob | null>;
  cancel(): void;
  transcribe(blob: Blob, options?: { signal?: AbortSignal; language?: string }): Promise<string>;
}

export function isSpeechSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export class LocalWhisperProvider implements SpeechProvider {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private lastBlob: Blob | null = null;
  private transcriber: AsrPipeline | null = null;

  isSupported(): boolean {
    return isSpeechSupported();
  }

  /** The live capture stream, so the UI can meter input without opening a second stream. */
  getStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    if (!this.isSupported()) throw new Error("Recording is not supported in this browser.");
    if (this.recorder) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
    this.chunks = [];
    this.lastBlob = null;

    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  /**
   * `MediaRecorder.stop()` is asynchronous: the final `dataavailable` event (and therefore the last
   * chunk of audio) arrives after the call returns. Building the Blob synchronously truncated the
   * recording, which silently dropped the end of every command. This waits for `onstop`.
   */
  stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!recorder) {
      this.releaseStream();
      return Promise.resolve(this.lastBlob);
    }

    return new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finalize = () => {
        if (settled) return;
        settled = true;
        const type = recorder.mimeType || "audio/webm";
        this.lastBlob = this.chunks.length ? new Blob(this.chunks, { type }) : null;
        this.recorder = null;
        this.releaseStream();
        resolve(this.lastBlob);
      };

      recorder.onstop = finalize;
      try {
        recorder.stop();
      } catch {
        // Already stopped or never started — still resolve with whatever arrived.
        finalize();
      }
    });
  }

  cancel(): void {
    if (this.recorder) {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.recorder = null;
    this.chunks = [];
    this.lastBlob = null;
    this.releaseStream();
  }

  private releaseStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private async getTranscriber(signal?: AbortSignal): Promise<AsrPipeline> {
    if (this.transcriber) return this.transcriber;
    if (signal?.aborted) throw new Error("Cancelled.");

    const mod = await loadTransformers();
    this.transcriber = await mod.pipeline("automatic-speech-recognition", STT_MODEL, {
      dtype: "q8",
    });
    return this.transcriber;
  }

  async transcribe(
    blob: Blob,
    options: { signal?: AbortSignal; language?: string } = {},
  ): Promise<string> {
    if (!blob.size) return "";
    if (options.signal?.aborted) throw new Error("Cancelled.");

    const audio = await decodeToMono16k(blob);
    if (options.signal?.aborted) throw new Error("Cancelled.");

    const transcriber = await this.getTranscriber(options.signal);
    const result = await transcriber(audio, {
      sampling_rate: 16000,
      chunk_length_s: 30,
      language: options.language,
      task: "transcribe",
    });

    if (Array.isArray(result)) return result.map((r) => r.text ?? "").join(" ").trim();
    return (result.text ?? "").trim();
  }
}

/** Decodes any recorded container into 16 kHz mono float samples Whisper can consume. */
async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtor =
    typeof window !== "undefined"
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!AudioCtor) throw new Error("Audio decoding is not supported in this browser.");

  const context = new AudioCtor();
  try {
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const targetRate = 16000;
    const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, frames, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    void context.close();
  }
}

let sharedSpeech: LocalWhisperProvider | null = null;

export function getSpeechProvider(): LocalWhisperProvider {
  if (!sharedSpeech) sharedSpeech = new LocalWhisperProvider();
  return sharedSpeech;
}
