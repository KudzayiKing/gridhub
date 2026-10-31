/**
 * Read-only migration assessment for legacy local-first records.
 *
 * This does not write to IndexedDB or Supabase. It only proposes workspace
 * assignments where the owner and a unique default personal workspace are known.
 */

export interface WorkspaceCandidate {
  id: string;
  ownerUserId: string;
  kind: "personal" | "business";
  isDefault: boolean;
}

export interface LegacyRecordEnvelope {
  id: string;
  toolId: string;
  collection: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
  deleted: 0 | 1;
  dirty: 0 | 1;
  /** `cloud` means fetched from the authenticated user's sync partition. */
  source: "cloud" | "local";
  /** Local rows only have an owner when a prior trusted association recorded it. */
  ownerUserId?: string;
  workspaceId?: string;
}

export interface PendingMutationEnvelope {
  id: string;
  recordId: string;
  payload: string;
  createdAt: string;
  attempts: number;
}

export interface WorkspaceMigrationProposal {
  recordId: string;
  status: "already-scoped" | "assign-default" | "needs-review" | "blocked";
  workspaceId?: string;
  reason: string;
}

export interface WorkspaceMigrationPreflight {
  proposals: WorkspaceMigrationProposal[];
  /** Copied verbatim so callers can verify pending work is never discarded. */
  pendingMutations: PendingMutationEnvelope[];
  orphanedMutationRecordIds: string[];
}

export function planLegacyWorkspaceScope(input: {
  userId: string;
  workspaces: WorkspaceCandidate[];
  records: LegacyRecordEnvelope[];
  pendingMutations: PendingMutationEnvelope[];
}): WorkspaceMigrationPreflight {
  const ownedWorkspaces = input.workspaces.filter((workspace) => workspace.ownerUserId === input.userId);
  const workspaceById = new Map(ownedWorkspaces.map((workspace) => [workspace.id, workspace]));
  const defaults = ownedWorkspaces.filter((workspace) => workspace.kind === "personal" && workspace.isDefault);
  const defaultWorkspace = defaults.length === 1 ? defaults[0] : undefined;

  const proposals = input.records.map((record): WorkspaceMigrationProposal => {
    if (record.source === "local" && record.ownerUserId !== input.userId) {
      return {
        recordId: record.id,
        status: record.ownerUserId ? "blocked" : "needs-review",
        reason: record.ownerUserId
          ? "Local record is associated with a different user."
          : "Local record has no trusted user association; do not attach it to the current account automatically.",
      };
    }

    if (record.workspaceId) {
      if (workspaceById.has(record.workspaceId)) {
        return {
          recordId: record.id,
          status: "already-scoped",
          workspaceId: record.workspaceId,
          reason: "Record already points to a workspace owned by the authenticated user.",
        };
      }
      return {
        recordId: record.id,
        status: "blocked",
        reason: "Record references a workspace that is not owned by the authenticated user.",
      };
    }

    if (!defaultWorkspace) {
      return {
        recordId: record.id,
        status: "needs-review",
        reason: "A unique default personal workspace owned by this user could not be identified.",
      };
    }

    return {
      recordId: record.id,
      status: "assign-default",
      workspaceId: defaultWorkspace.id,
      reason: record.source === "cloud"
        ? "Cloud record came from this authenticated user's sync partition and has one default personal workspace."
        : "Local record has a trusted association with this user and one default personal workspace.",
    };
  });

  const recordIds = new Set(input.records.map((record) => record.id));
  const pendingMutations = input.pendingMutations.map((mutation) => ({ ...mutation }));
  const orphanedMutationRecordIds = [...new Set(
    pendingMutations.filter((mutation) => !recordIds.has(mutation.recordId)).map((mutation) => mutation.recordId),
  )];

  return { proposals, pendingMutations, orphanedMutationRecordIds };
}
