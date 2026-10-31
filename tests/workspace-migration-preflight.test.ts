import { describe, expect, it } from "vitest";
import { ALL_TOOL_IDS } from "@/lib/catalog";
import {
  planLegacyWorkspaceScope,
  type LegacyRecordEnvelope,
  type PendingMutationEnvelope,
  type WorkspaceCandidate,
} from "@/lib/workspaces/migration-preflight";

const userId = "user-1";
const personalWorkspace: WorkspaceCandidate = {
  id: "workspace-personal",
  ownerUserId: userId,
  kind: "personal",
  isDefault: true,
};

function cloudRecord(id: string, toolId: string, overrides: Partial<LegacyRecordEnvelope> = {}): LegacyRecordEnvelope {
  return {
    id,
    toolId,
    collection: "records",
    data: { label: id },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 3,
    deleted: 0,
    dirty: 0,
    source: "cloud",
    ...overrides,
  };
}

function pending(id: string, recordId: string): PendingMutationEnvelope {
  return { id, recordId, payload: `{"recordId":"${recordId}"}`, createdAt: "2026-01-03T00:00:00.000Z", attempts: 2 };
}

describe("workspace migration preflight contract", () => {
  it("handles a new account with no records or pending mutations", () => {
    expect(planLegacyWorkspaceScope({ userId, workspaces: [personalWorkspace], records: [], pendingMutations: [] })).toEqual({
      proposals: [],
      pendingMutations: [],
      orphanedMutationRecordIds: [],
    });
  });

  it("handles an existing account with one tool populated", () => {
    const plan = planLegacyWorkspaceScope({
      userId,
      workspaces: [personalWorkspace],
      records: [cloudRecord("existing-budget-row", "budget", { collection: "transactions" })],
      pendingMutations: [],
    });
    expect(plan.proposals).toHaveLength(1);
    expect(plan.proposals[0]).toMatchObject({ status: "assign-default", workspaceId: personalWorkspace.id });
  });

  it("proposes preserving all 16 tools' cloud records in the one default workspace", () => {
    const records = ALL_TOOL_IDS.map((toolId) => cloudRecord(`record-${toolId}`, toolId));
    const plan = planLegacyWorkspaceScope({ userId, workspaces: [personalWorkspace], records, pendingMutations: [] });

    expect(records).toHaveLength(16);
    expect(plan.proposals).toHaveLength(16);
    expect(plan.proposals.every((proposal) => proposal.status === "assign-default" && proposal.workspaceId === personalWorkspace.id)).toBe(true);
    expect(plan.proposals.map((proposal) => proposal.recordId)).toEqual(records.map((record) => record.id));
  });

  it("does not assign local-only data without a trusted account association and preserves its outbox", () => {
    const records: LegacyRecordEnvelope[] = [
      cloudRecord("offline-expense", "budget", { source: "local", dirty: 1, data: { amount: 45, currency: "USD" } }),
      cloudRecord("offline-task", "projects", { source: "local", dirty: 1, data: { projectId: "local-project", title: "Offline task" } }),
    ];
    const queued = [pending("mutation-1", records[0].id), pending("mutation-2", records[1].id)];
    const before = structuredClone({ records, queued });
    const plan = planLegacyWorkspaceScope({ userId, workspaces: [personalWorkspace], records, pendingMutations: queued });

    expect(plan.proposals.map((proposal) => proposal.status)).toEqual(["needs-review", "needs-review"]);
    expect(plan.pendingMutations).toEqual(queued);
    expect(plan.orphanedMutationRecordIds).toEqual([]);
    expect({ records, queued }).toEqual(before);
  });

  it("handles both unscoped legacy rows and already-scoped rows without widening ownership", () => {
    const plan = planLegacyWorkspaceScope({
      userId,
      workspaces: [personalWorkspace],
      records: [
        cloudRecord("legacy-v1", "content"),
        cloudRecord("scoped-v2", "projects", { workspaceId: personalWorkspace.id }),
      ],
      pendingMutations: [],
    });
    expect(plan.proposals.map((proposal) => proposal.status)).toEqual(["assign-default", "already-scoped"]);
    expect(plan.proposals.map((proposal) => proposal.workspaceId)).toEqual([personalWorkspace.id, personalWorkspace.id]);
  });

  it("retains deletion, version, currency and parent references without rewriting payloads", () => {
    const records = [
      cloudRecord("deleted-ledger-row", "bookkeeping", {
        collection: "transactions", deleted: 1, version: 8,
        data: { amount: 400, currency: "EUR", categoryId: "category-1", sourceId: "sale-9" },
      }),
      cloudRecord("project-task", "projects", {
        collection: "tasks", data: { projectId: "project-1", milestoneId: "milestone-1" },
      }),
      cloudRecord("property-booking", "property", {
        collection: "bookings", data: { propertyId: "property-1", unitId: "unit-1", currency: "USD" },
      }),
    ];
    const before = structuredClone(records);
    const plan = planLegacyWorkspaceScope({ userId, workspaces: [personalWorkspace], records, pendingMutations: [] });

    expect(plan.proposals.every((proposal) => proposal.status === "assign-default")).toBe(true);
    expect(records).toEqual(before);
    expect(records[0]).toMatchObject({ deleted: 1, version: 8, data: { currency: "EUR", sourceId: "sale-9" } });
  });

  it("requires reconciliation if there is no unique default personal workspace", () => {
    const secondDefault = { ...personalWorkspace, id: "workspace-second" };
    const plan = planLegacyWorkspaceScope({
      userId,
      workspaces: [personalWorkspace, secondDefault],
      records: [cloudRecord("legacy-1", "budget")],
      pendingMutations: [],
    });
    expect(plan.proposals[0].status).toBe("needs-review");
    expect(plan.proposals[0].workspaceId).toBeUndefined();
  });

  it("blocks records claiming a workspace owned by another user", () => {
    const plan = planLegacyWorkspaceScope({
      userId,
      workspaces: [personalWorkspace],
      records: [cloudRecord("foreign", "projects", { workspaceId: "workspace-other" })],
      pendingMutations: [],
    });
    expect(plan.proposals[0].status).toBe("blocked");
    expect(plan.proposals[0].workspaceId).toBeUndefined();
  });

  it("keeps orphaned outbox entries and reports them for reconciliation", () => {
    const mutation = pending("mutation-orphan", "missing-record");
    const plan = planLegacyWorkspaceScope({ userId, workspaces: [personalWorkspace], records: [], pendingMutations: [mutation] });
    expect(plan.pendingMutations).toEqual([mutation]);
    expect(plan.orphanedMutationRecordIds).toEqual(["missing-record"]);
  });

  it("is deterministic when a preflight is retried after interruption", () => {
    const input = {
      userId,
      workspaces: [personalWorkspace],
      records: [cloudRecord("r1", "budget"), cloudRecord("r2", "projects")],
      pendingMutations: [pending("m1", "r1")],
    };
    expect(planLegacyWorkspaceScope(input)).toEqual(planLegacyWorkspaceScope(input));
  });
});
