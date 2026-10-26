/**
 * Gridhub AI — command routing.
 *
 * Deterministic commands are answered without the model. An optional model fallback remains for
 * callers that explicitly allow it; the signed-in text-command UI currently uses deterministic-only
 * routing. Both paths converge on the same proposal shape and authorization checks.
 */

import { AI_LOCALE, AI_MODEL } from "./model-manifest";
import { deterministicParse } from "./deterministic-parser";
import { buildPrompt } from "./context-builder";
import { validateModelOutput, type AIProposal } from "./action-validator";
import { actionsForTools } from "./action-registry";
import { getInferenceProvider } from "./inference-provider";
import { allowedToolIds, type EntitlementState } from "./permission-checker";

export interface RouteOptions {
  entitlement: EntitlementState;
  today: string;
  timeZone: string;
  locale?: string;
  language?: string;
  signal?: AbortSignal;
  /** When true, only deterministic commands are attempted. */
  deterministicOnly?: boolean;
}

export type RouteResult =
  | { kind: "proposal"; proposal: AIProposal; source: "deterministic" | "model" }
  | { kind: "clarification"; question: string; options?: string[] }
  | { kind: "unsupported"; reason?: string }
  | { kind: "error"; message: string };

export async function routeCommand(text: string, options: RouteOptions): Promise<RouteResult> {
  const deterministic = deterministicParse(text, options.language ?? options.locale);
  if (deterministic) {
    return {
      kind: "proposal",
      source: "deterministic",
      proposal: {
        intent: deterministic.intent,
        actionId: deterministic.actionId,
        parameters: deterministic.parameters,
        path: deterministic.path,
      },
    };
  }

  if (options.deterministicOnly) {
    return {
      kind: "unsupported",
      reason: "I couldn't match that to a simple command. Try “Add $40 for groceries,” open a tool, or enter it there directly.",
    };
  }

  const tools = allowedToolIds(options.entitlement);
  const actions = actionsForTools(tools);

  if (!actions.length) {
    return { kind: "unsupported", reason: "No tools are enabled for this plan." };
  }

  const prompt = await buildPrompt({
    text,
    actions,
    tools,
    locale: options.locale ?? AI_LOCALE,
    timeZone: options.timeZone,
    today: options.today,
  });

  try {
    const provider = getInferenceProvider(AI_MODEL);
    const raw = await provider.interpret(prompt, {
      signal: options.signal,
      allowedActions: actions.map((a) => a.id),
    });

    const validated = validateModelOutput(raw);
    if (!validated.ok) {
      return {
        kind: "clarification",
        question: "I couldn't turn that into a safe action. Could you rephrase it?",
      };
    }

    const proposal = validated.proposal;
    if (proposal.intent === "clarification") {
      return {
        kind: "clarification",
        question: proposal.question ?? "Could you give me a bit more detail?",
        options: proposal.options,
      };
    }
    if (proposal.intent === "unsupported") {
      return { kind: "unsupported", reason: proposal.reason };
    }

    return { kind: "proposal", proposal, source: "model" };
  } catch (error) {
    if (error instanceof Error && /abort|cancel/i.test(error.message)) {
      return { kind: "error", message: "Cancelled." };
    }
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "The local model failed.",
    };
  }
}
