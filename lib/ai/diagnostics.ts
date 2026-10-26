/** Local-only, content-free timing logs for reproducing browser AI issues. */
export function logAIDiagnostic(event: string, details: Record<string, unknown> = {}) {
  if (typeof console === "undefined") return;
  console.info("[GridHub AI diagnostics]", {
    event,
    at: new Date().toISOString(),
    ...details,
  });
}

export function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10;
}
