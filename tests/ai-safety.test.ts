import { describe, expect, it } from "vitest";
import {
  ACTION_SCHEMAS,
  AIResponseSchema,
  isActionId,
  type ActionId,
} from "@/lib/ai/action-schemas";
import { REGISTERED_ACTIONS, getAction, registryMatchesSchemas } from "@/lib/ai/action-registry";
import { validateModelOutput, extractJson } from "@/lib/ai/action-validator";
import {
  allowedToolIds,
  canUseTool,
  entitledToolSet,
  type EntitlementState,
} from "@/lib/ai/permission-checker";

const ALL_TOOLS = [
  "budget",
  "debt",
  "savings",
  "net-worth",
  "paycheck",
  "bookkeeping",
  "inventory",
  "sales",
  "invoicing",
  "cash-flow",
  "wedding",
  "property",
  "nutrition",
  "projects",
  "habits",
  "content",
] as const;

function state(overrides: Partial<EntitlementState>): EntitlementState {
  return {
    plan: "free",
    entitledTools: [],
    activeTools: [],
    configured: true,
    ...overrides,
  };
}

describe("action registry integrity", () => {
  it("keeps the registry and the Zod schemas in exact agreement", () => {
    expect(registryMatchesSchemas()).toBe(true);
  });

  it("has a registry entry for every schema and vice versa", () => {
    const schemaIds = Object.keys(ACTION_SCHEMAS).sort();
    const registryIds = REGISTERED_ACTIONS.map((a) => a.id).sort();
    expect(registryIds).toEqual(schemaIds);
  });

  it("covers every one of the sixteen tools", () => {
    const covered = new Set(REGISTERED_ACTIONS.map((a) => a.toolId));
    for (const tool of ALL_TOOLS) {
      expect(covered.has(tool as never), `no actions registered for ${tool}`).toBe(true);
    }
  });

  it("marks every write as requiring confirmation and every query as not", () => {
    for (const action of REGISTERED_ACTIONS) {
      if (action.kind === "query") {
        expect(action.requiresConfirmation, `${action.id} should not need confirmation`).toBe(
          false,
        );
      } else {
        expect(action.requiresConfirmation, `${action.id} must need confirmation`).toBe(true);
      }
    }
  });

  it("gives every action at least one example and a description", () => {
    for (const action of REGISTERED_ACTIONS) {
      expect(action.examples.length).toBeGreaterThan(0);
      expect(action.description.length).toBeGreaterThan(0);
    }
  });
});

describe("model output validation", () => {
  it("accepts a well-formed write proposal", () => {
    const result = validateModelOutput(
      JSON.stringify({
        intent: "action",
        actionId: "budget.create_expense",
        parameters: { amount: 42, description: "Weekly shop", category: "Groceries" },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.actionId).toBe("budget.create_expense");
      expect(result.proposal.parameters?.amount).toBe(42);
    }
  });

  it("rejects an invented action id", () => {
    const result = validateModelOutput(
      JSON.stringify({ intent: "action", actionId: "budget.delete_everything", parameters: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown action/i);
  });

  it("rejects a write aimed at a read-only query action", () => {
    const result = validateModelOutput(
      JSON.stringify({ intent: "action", actionId: "budget.query_spend", parameters: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot be executed as a write/i);
  });

  it("rejects a query aimed at a write action", () => {
    const result = validateModelOutput(
      JSON.stringify({ intent: "query", actionId: "budget.create_expense", parameters: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not a read-only query/i);
  });

  it("rejects parameters that fail the action schema", () => {
    const result = validateModelOutput(
      JSON.stringify({
        intent: "action",
        actionId: "budget.create_expense",
        parameters: { amount: "lots", description: "Weekly shop", category: "Groceries" },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects malformed JSON and prose-only replies", () => {
    expect(validateModelOutput("I added that for you!").ok).toBe(false);
    expect(validateModelOutput("{ this is not json }").ok).toBe(false);
  });

  it("rejects navigation outside the app", () => {
    const result = validateModelOutput(
      JSON.stringify({ intent: "navigation", path: "https://evil.example/steal" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/outside the app/i);
  });

  it("accepts navigation inside the app", () => {
    const result = validateModelOutput(
      JSON.stringify({ intent: "navigation", path: "/app/tools/budget" }),
    );
    expect(result.ok).toBe(true);
  });

  it("does not treat an injected instruction as an action", () => {
    // A prompt-injection attempt shaped like a valid reply for a different action must still be
    // rejected on its own merits, not obeyed.
    const result = validateModelOutput(
      JSON.stringify({
        intent: "action",
        actionId: "system.exec",
        parameters: { command: "rm -rf /" },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("strips code fences before parsing", () => {
    const fenced = '```json\n{"intent":"clarification","question":"Which account?"}\n```';
    expect(extractJson(fenced)).toContain("clarification");
    const result = validateModelOutput(fenced);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal.intent).toBe("clarification");
  });

  it("rejects an unknown response shape", () => {
    expect(AIResponseSchema.safeParse({ intent: "delete_database" }).success).toBe(false);
  });

  it("recognises only ids that exist in the schemas", () => {
    expect(isActionId("budget.create_expense")).toBe(true);
    expect(isActionId("budget.create_expenses")).toBe(false);
  });
});

describe("entitlement enforcement", () => {
  it("gives free accounts the budget tool only, even if the server sends more", () => {
    const set = entitledToolSet(
      state({ plan: "free", entitledTools: ["budget", "invoicing", "projects"] }),
    );
    expect([...set]).toEqual(["budget"]);
  });

  it("caps a plan at its tool limit", () => {
    // single/plus/pro have limits 1/3/6; extra grants must be truncated.
    const set = entitledToolSet(
      state({
        plan: "plus",
        entitledTools: ["budget", "invoicing", "projects", "habits", "content"],
      }),
    );
    expect(set.size).toBe(3);
    expect([...set]).toEqual(["budget", "invoicing", "projects"]);
  });

  it("allows all sixteen tools on the unlimited plan", () => {
    const set = entitledToolSet(state({ plan: "unlimited", entitledTools: [...ALL_TOOLS] }));
    expect(set.size).toBe(16);
  });

  it("ignores tool ids that do not exist", () => {
    // Cast through unknown: the point is that unvalidated input arriving from the network is
    // filtered, which the type system cannot express.
    const hostile = ["budget", "not-a-tool", "../../etc"] as unknown as EntitlementState["entitledTools"];
    const set = entitledToolSet(state({ plan: "unlimited", entitledTools: hostile }));
    expect([...set]).toEqual(["budget"]);
  });

  it("falls back to device activations when the server is not configured", () => {
    const set = entitledToolSet(
      state({ configured: false, plan: "free", activeTools: ["budget", "habits"] }),
    );
    expect([...set].sort()).toEqual(["budget", "habits"]);
  });

  it("refuses a tool the account is not entitled to", () => {
    const s = state({ plan: "single", entitledTools: ["invoicing"] });
    expect(canUseTool("invoicing", s)).toBe(true);
    expect(canUseTool("budget", s)).toBe(false);
    expect(allowedToolIds(s)).toEqual(["invoicing"]);
  });
});

describe("action schemas", () => {
  it("coerces numeric strings for money amounts", () => {
    const parsed = ACTION_SCHEMAS["budget.create_expense"].parse({
      amount: "12.50",
      description: "Coffee",
      category: "Coffee",
    });
    expect(parsed.amount).toBe(12.5);
  });

  it("rejects a negative amount", () => {
    const result = ACTION_SCHEMAS["budget.create_expense"].safeParse({
      amount: -5,
      description: "Coffee",
      category: "Coffee",
    });
    expect(result.success).toBe(false);
  });

  it("treats an empty category as no category rather than an error", () => {
    // The executor guards with `if (p.category)`, so "" falls through to uncategorised. Rejecting it
    // would make the model's harmless "" a hard failure for no benefit.
    const result = ACTION_SCHEMAS["budget.create_expense"].safeParse({
      amount: 5,
      description: "Coffee",
      category: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category).toBe("");
  });

  it("rejects a missing description", () => {
    const result = ACTION_SCHEMAS["budget.create_expense"].safeParse({ amount: 5 });
    expect(result.success).toBe(false);
  });

  it("exposes a label for every registered action", () => {
    for (const id of Object.keys(ACTION_SCHEMAS) as ActionId[]) {
      expect(getAction(id)?.label).toBeTruthy();
    }
  });
});
