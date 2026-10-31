import { describe, expect, it } from "vitest";
import { belongsToWorkspaceScope, type WorkspaceScope } from "@/lib/workspaces/context";

describe("workspace record scope", () => {
  const alicePersonal: WorkspaceScope = { workspaceId: "workspace-alice", ownerUserId: "alice" };
  const aliceBusiness: WorkspaceScope = { workspaceId: "workspace-alice-business", ownerUserId: "alice" };
  const bobPersonal: WorkspaceScope = { workspaceId: "workspace-bob", ownerUserId: "bob" };

  it("accepts only records owned by the exact active workspace and account", () => {
    expect(belongsToWorkspaceScope({ workspaceId: alicePersonal.workspaceId, ownerUserId: "alice" }, alicePersonal)).toBe(true);
    expect(belongsToWorkspaceScope({ workspaceId: aliceBusiness.workspaceId, ownerUserId: "alice" }, alicePersonal)).toBe(false);
    expect(belongsToWorkspaceScope({ workspaceId: bobPersonal.workspaceId, ownerUserId: "bob" }, alicePersonal)).toBe(false);
    expect(belongsToWorkspaceScope({ workspaceId: alicePersonal.workspaceId, ownerUserId: "bob" }, alicePersonal)).toBe(false);
  });

  it("keeps unscoped pre-workspace rows quarantined until explicit association", () => {
    expect(belongsToWorkspaceScope({ ownerUserId: null }, alicePersonal)).toBe(false);
    expect(belongsToWorkspaceScope({ workspaceId: "local-personal-workspace", ownerUserId: null }, {
      workspaceId: "local-personal-workspace",
      ownerUserId: null,
    })).toBe(true);
  });

  it("does not let a matching workspace id cross an account boundary", () => {
    expect(belongsToWorkspaceScope({ workspaceId: alicePersonal.workspaceId, ownerUserId: null }, alicePersonal)).toBe(false);
  });
});
