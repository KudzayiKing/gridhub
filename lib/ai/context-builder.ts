/**
 * Gridhub AI — prompt context.
 *
 * The model gets a short, purpose-built brief: the actions the customer is allowed to use, and the
 * names of the records those actions can reference. It never receives the database, and it never
 * receives ids it could fabricate.
 */

import { listRecords } from "@/lib/store";
import type { BaseRecord } from "@/lib/types";
import type { ToolId } from "@/lib/catalog";
import type { RegisteredAction } from "./action-registry";
import { ACTION_SCHEMAS } from "./action-schemas";

interface EntitySource {
  collection: string;
  field: string;
  label: string;
}

/** Only the collections that actions actually resolve names against. */
const ENTITY_SOURCES: Partial<Record<ToolId, EntitySource[]>> = {
  budget: [
    { collection: "categories", field: "name", label: "categories" },
    { collection: "accounts", field: "name", label: "accounts" },
  ],
  debt: [{ collection: "debts", field: "name", label: "debts" }],
  savings: [{ collection: "goals", field: "name", label: "savings goals" }],
  inventory: [{ collection: "products", field: "name", label: "products" }],
  sales: [{ collection: "products", field: "name", label: "products" }],
  invoicing: [{ collection: "contacts", field: "name", label: "customers" }],
  bookkeeping: [{ collection: "contacts", field: "name", label: "contacts" }],
  projects: [
    { collection: "projects", field: "name", label: "projects" },
    { collection: "tasks", field: "title", label: "tasks" },
  ],
  habits: [{ collection: "habits", field: "name", label: "habits" }],
  content: [
    { collection: "plans", field: "name", label: "content plans" },
    { collection: "channels", field: "name", label: "channel accounts" },
    { collection: "campaigns", field: "name", label: "campaigns" },
  ],
  property: [{ collection: "properties", field: "name", label: "properties" }],
  nutrition: [{ collection: "foods", field: "name", label: "saved foods" }],
  wedding: [{ collection: "vendors", field: "name", label: "vendors" }],
};

function paramNames(actionId: string): string[] {
  const schema = ACTION_SCHEMAS[actionId as keyof typeof ACTION_SCHEMAS] as unknown as {
    shape?: Record<string, unknown>;
  };
  return schema?.shape ? Object.keys(schema.shape) : [];
}

export interface PromptInput {
  text: string;
  actions: RegisteredAction[];
  tools: ToolId[];
  locale: string;
  timeZone: string;
  today: string;
}

async function entityLines(tools: ToolId[]): Promise<string[]> {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const toolId of tools) {
    const sources = ENTITY_SOURCES[toolId];
    if (!sources) continue;
    for (const source of sources) {
      const key = `${toolId}:${source.collection}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let rows: BaseRecord[] = [];
      try {
        rows = await listRecords<BaseRecord>(toolId, source.collection);
      } catch {
        rows = [];
      }
      const names = rows
        .map((row) => (row as unknown as Record<string, unknown>)[source.field])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .slice(0, 24);

      if (names.length) lines.push(`${source.label}: ${names.join(", ")}`);
    }
  }
  return lines;
}

export async function buildPrompt(input: PromptInput): Promise<string> {
  const actionLines = input.actions.map((action) => {
    const params = paramNames(action.id);
    return `- ${action.id}(${params.join(", ")}) — ${action.description}`;
  });

  const entities = await entityLines(input.tools);

  return [
    "You are Gridhub AI, a private assistant running on the user's own device.",
    "Interpret the user's request and return ONLY a single minified JSON object. No prose, no markdown, no code fences.",
    `Today is ${input.today}. Locale ${input.locale}; time zone ${input.timeZone}.`,
    "",
    "Allowed actions — use only these ids:",
    ...actionLines,
    "",
    entities.length ? "Known record names (reference these; never invent ids):" : "No saved records yet.",
    ...entities,
    "",
    "Response shapes (exactly one):",
    '{"intent":"action","actionId":"<id>","parameters":{...}}',
    '{"intent":"query","actionId":"<id>","parameters":{...}}',
    '{"intent":"clarification","question":"...","options":["..."]}',
    '{"intent":"unsupported","reason":"..."}',
    '{"intent":"navigation","path":"/app/..."}',
    "",
    "Rules:",
    "- Pick the single best action from the allowed list.",
    "- Use relative dates (today, yesterday) or YYYY-MM-DD.",
    "- Never invent amounts, ids, nutrition values, or record names.",
    "- If a required value is missing or ambiguous, return clarification instead of guessing.",
    "- If nothing fits, return unsupported.",
    "",
    `User request: ${JSON.stringify(input.text)}`,
  ].join("\n");
}
