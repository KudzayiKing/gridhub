/**
 * Gridhub AI — model output validation.
 *
 * Nothing the model says is trusted. Its text is reduced to JSON, matched against the response
 * union, checked against the action allowlist, and finally parsed by the action's Zod schema.
 * Malformed or invented output is rejected rather than guessed at.
 */

import { ACTION_SCHEMAS, AIResponseSchema, isActionId, type ActionId } from "./action-schemas";
import { getAction } from "./action-registry";

export interface AIProposal {
  intent: "action" | "query" | "clarification" | "unsupported" | "navigation";
  actionId?: ActionId;
  parameters?: Record<string, unknown>;
  path?: string;
  question?: string;
  options?: string[];
  reason?: string;
}

export type ValidationResult =
  | { ok: true; proposal: AIProposal }
  | { ok: false; error: string; raw: string };

/** Pulls the first JSON object out of a model reply, tolerating code fences and stray prose. */
export function extractJson(raw: string): string | null {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function validateModelOutput(raw: string): ValidationResult {
  const json = extractJson(raw);
  if (!json) return { ok: false, error: "The model did not return JSON.", raw };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "The model returned invalid JSON.", raw };
  }

  const result = AIResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "The model response did not match a known shape.", raw };
  }

  const response = result.data;

  switch (response.intent) {
    case "navigation": {
      if (!response.path.startsWith("/app")) {
        return { ok: false, error: "Navigation target was outside the app.", raw };
      }
      return { ok: true, proposal: { intent: "navigation", path: response.path } };
    }
    case "clarification":
      return {
        ok: true,
        proposal: {
          intent: "clarification",
          question: response.question,
          options: response.options,
        },
      };
    case "unsupported":
      return { ok: true, proposal: { intent: "unsupported", reason: response.reason } };

    case "action": {
      if (!isActionId(response.actionId)) {
        return { ok: false, error: `Unknown action "${response.actionId}".`, raw };
      }
      const meta = getAction(response.actionId);
      if (!meta || meta.kind === "query") {
        return { ok: false, error: "That action cannot be executed as a write.", raw };
      }
      const params = ACTION_SCHEMAS[response.actionId].safeParse(response.parameters ?? {});
      if (!params.success) {
        return { ok: false, error: `Parameters for ${response.actionId} were invalid.`, raw };
      }
      return {
        ok: true,
        proposal: {
          intent: "action",
          actionId: response.actionId,
          parameters: params.data as Record<string, unknown>,
        },
      };
    }

    case "query": {
      if (!response.actionId) {
        return {
          ok: true,
          proposal: {
            intent: "query",
            parameters: response.parameters,
            question: response.question,
          },
        };
      }
      if (!isActionId(response.actionId)) {
        return { ok: false, error: `Unknown query "${response.actionId}".`, raw };
      }
      const meta = getAction(response.actionId);
      if (!meta || meta.kind !== "query") {
        return { ok: false, error: "That action is not a read-only query.", raw };
      }
      const params = ACTION_SCHEMAS[response.actionId].safeParse(response.parameters ?? {});
      if (!params.success) {
        return { ok: false, error: "Query parameters were invalid.", raw };
      }
      return {
        ok: true,
        proposal: {
          intent: "query",
          actionId: response.actionId,
          parameters: params.data as Record<string, unknown>,
        },
      };
    }
  }
}
