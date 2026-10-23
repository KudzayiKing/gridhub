/**
 * Public availability of GridHub AI.
 *
 * The feature is implemented in the app — model manager, worker inference, speech install, the
 * action registry and the confirmation flow — but it has **not** been verified end to end on real
 * devices. Until it has, every public surface must label it as in development. That is the launch
 * rule from the marketing brief: only display a feature as available once it is actually
 * functional.
 *
 * Flip `AI_PUBLICLY_AVAILABLE` only after all of the following pass on a clean profile:
 *   1. the 1.87 GiB model downloads, hashes and installs without a reload;
 *   2. a typed command is routed, prepared and confirmed, and the record appears;
 *   3. a spoken command transcribes and does the same;
 *   4. the whole flow still works with the network disabled;
 *   5. the worker path is used (not the inline fallback) on a mid-range phone.
 */
export const AI_PUBLICLY_AVAILABLE = false;

/** Short status word for badges and card rows. */
export const AI_PUBLIC_LABEL = AI_PUBLICLY_AVAILABLE ? "Available" : "In development";

/** One line of context, used under headings where a badge alone is too terse. */
export const AI_PUBLIC_NOTE = AI_PUBLICLY_AVAILABLE
  ? "Available on compatible devices after a one-time model download."
  : "In development. The interface and on-device model work exist, but we have not finished verifying them end to end — so nothing here is switched on yet.";

/** Shown next to any claim that reads like a live capability. */
export const AI_PUBLIC_CAVEAT =
  "AI availability depends on device and browser compatibility, and initial setup requires an internet connection.";
