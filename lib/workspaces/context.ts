"use client";

export interface WorkspaceSummary {
  id: string;
  ownerUserId: string | null;
  name: string;
  kind: "personal" | "business";
  isDefault: boolean;
  archivedAt?: string | null;
  localOnly?: boolean;
}

export interface WorkspaceScope {
  workspaceId: string;
  ownerUserId: string | null;
}

export function belongsToWorkspaceScope(
  envelope: { workspaceId?: string; ownerUserId?: string | null },
  scope: WorkspaceScope,
): boolean {
  return envelope.workspaceId === scope.workspaceId && (envelope.ownerUserId ?? null) === scope.ownerUserId;
}

const LOCAL_WORKSPACE_ID = "local-personal-workspace";
let activeScope: WorkspaceScope = { workspaceId: LOCAL_WORKSPACE_ID, ownerUserId: null };
const listeners = new Set<() => void>();

export const LOCAL_PERSONAL_WORKSPACE: WorkspaceSummary = {
  id: LOCAL_WORKSPACE_ID,
  ownerUserId: null,
  name: "Personal workspace",
  kind: "personal",
  isDefault: true,
  localOnly: true,
};

export function getWorkspaceScope(): WorkspaceScope {
  return activeScope;
}

export function setWorkspaceScope(scope: WorkspaceScope): void {
  if (activeScope.workspaceId === scope.workspaceId && activeScope.ownerUserId === scope.ownerUserId) return;
  activeScope = scope;
  listeners.forEach((listener) => listener());
}

export function subscribeWorkspaceScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocalWorkspaceId(): string {
  return LOCAL_WORKSPACE_ID;
}
