"use client";

/**
 * Gridhub AI — microphone capture for the panel.
 *
 * Opens the microphone only after an explicit user gesture, meters the input for the waveform,
 * transcribes locally, then releases the stream. Nothing is retained: the Blob is dropped as soon
 * as the transcript exists.
 */

import * as React from "react";
import { getSpeechProvider } from "@/lib/ai/speech-provider";

export type RecorderStatus = "idle" | "requesting" | "recording" | "transcribing" | "error";

export interface UseAIRecorder {
  status: RecorderStatus;
  seconds: number;
  /** 0–1 RMS level, for the waveform bars. */
  level: number;
  error: string | null;
  supported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  cancel: () => void;
  clearError: () => void;
}

/** Hard cap so a forgotten recording can never run away. */
const MAX_SECONDS = 60;

export interface RecorderOptions {
  language?: string;
  /** Called when the recording hits MAX_SECONDS and is stopped automatically. */
  onAutoStop?: (text: string | null) => void;
}

export function useAIRecorder(options: RecorderOptions = {}): UseAIRecorder {
  const { language = "en", onAutoStop } = options;

  const [status, setStatus] = React.useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const timer = React.useRef<number | null>(null);
  const raf = React.useRef<number | null>(null);
  const audioCtx = React.useRef<AudioContext | null>(null);
  const stopMetering = React.useRef<(() => void) | null>(null);
  const elapsed = React.useRef(0);
  const stopRef = React.useRef<(() => Promise<string | null>) | null>(null);
  const autoStopCb = React.useRef(onAutoStop);

  React.useEffect(() => {
    autoStopCb.current = onAutoStop;
  }, [onAutoStop]);

  const supported = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return getSpeechProvider().isSupported();
  }, []);

  const cleanup = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    stopMetering.current?.();
    stopMetering.current = null;
    if (audioCtx.current) {
      void audioCtx.current.close().catch(() => {});
      audioCtx.current = null;
    }
    setLevel(0);
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    setStatus("requesting");
    const provider = getSpeechProvider();
    try {
      await provider.start();
      setStatus("recording");
      elapsed.current = 0;
      setSeconds(0);

      timer.current = window.setInterval(() => {
        elapsed.current += 1;
        setSeconds(elapsed.current);
        if (elapsed.current >= MAX_SECONDS) {
          if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
          void stopRef.current?.().then((text) => autoStopCb.current?.(text));
        }
      }, 1000);

      // Metering is cosmetic; a failure here must not break recording.
      const stream = provider.getStream();
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (stream && AudioCtor) {
        try {
          const ctx = new AudioCtor();
          audioCtx.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const buffer = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            analyser.getByteTimeDomainData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i += 1) {
              const v = (buffer[i] - 128) / 128;
              sum += v * v;
            }
            setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 4));
            raf.current = requestAnimationFrame(tick);
          };
          tick();
          stopMetering.current = () => {
            source.disconnect();
            analyser.disconnect();
          };
        } catch {
          // No metering; recording continues.
        }
      }
    } catch (err) {
      cleanup();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was blocked. You can still type your command."
          : err instanceof Error
            ? err.message
            : "The microphone could not be started.";
      setError(message);
      setStatus("error");
    }
  }, [cleanup]);

  const stop = React.useCallback(async () => {
    const provider = getSpeechProvider();
    cleanup();
    const blob = await provider.stop();
    if (!blob || blob.size === 0) {
      setStatus("idle");
      setError("I didn't catch any audio. Try again, or type it instead.");
      return null;
    }

    setStatus("transcribing");
    try {
      const text = await provider.transcribe(blob, { language });
      setStatus("idle");
      setSeconds(0);
      if (!text) {
        setError("I couldn't make out any words. Try again, or type it instead.");
        return null;
      }
      return text;
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "The speech model could not run. Typing works offline too.",
      );
      return null;
    }
  }, [cleanup, language]);

  React.useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const cancel = React.useCallback(() => {
    cleanup();
    getSpeechProvider().cancel();
    setStatus("idle");
    setSeconds(0);
    setError(null);
  }, [cleanup]);

  const clearError = React.useCallback(() => setError(null), []);

  // Release the microphone if the panel closes mid-recording.
  React.useEffect(
    () => () => {
      cleanup();
      getSpeechProvider().cancel();
    },
    [cleanup],
  );

  return { status, seconds, level, error, supported, start, stop, cancel, clearError };
}
