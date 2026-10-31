"use client";

import * as React from "react";
import { InfoIcon } from "@animateicons/react/lucide";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, Dropdown, DropdownContent, DropdownItem, DropdownTrigger, Tooltip } from "@/components/ui/overlay";
import { Field, Input, Select } from "@/components/ui/field";
import { attachLegacyLocalRows, claimLocalWorkspaceRows, countLegacyLocalRows, getMeta, setMeta } from "@/lib/store";
import { getDB, dbAvailable } from "@/lib/db";
import { getWorkspaceScope, LOCAL_PERSONAL_WORKSPACE, setWorkspaceScope, subscribeWorkspaceScope, type WorkspaceSummary } from "@/lib/workspaces/context";
import { runSync } from "@/lib/sync";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const WORKSPACES_UPDATED_EVENT = "gridhub:workspaces-updated";

function localWorkspaceListKey(userId: string | null) {
  return `workspaces:local:${userId ?? "device"}`;
}

function remoteWorkspaceListKey(userId: string) {
  return `workspaces:remote:${userId}`;
}

function announceWorkspaceListChange() {
  window.dispatchEvent(new Event(WORKSPACES_UPDATED_EVENT));
}

function selectedKey(userId: string | null) {
  return `workspace:selected:${userId ?? "local"}`;
}

export function WorkspaceSwitcher({ userId, onReady }: { userId: string | null; onReady: (ready: boolean) => void }) {
  const { t } = useI18n();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceSummary[]>([]);
  const [active, setActive] = React.useState<WorkspaceSummary | null>(null);
  const [ready, setReady] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newKind, setNewKind] = React.useState<"personal" | "business">("personal");
  const [legacyCounts, setLegacyCounts] = React.useState({ records: 0, mutations: 0 });
  const [busy, setBusy] = React.useState(false);

  const activate = React.useCallback((workspace: WorkspaceSummary) => {
    setActive(workspace);
    setWorkspaceScope({ workspaceId: workspace.id, ownerUserId: workspace.ownerUserId });
    localStorage.setItem(selectedKey(userId), workspace.id);
    if (!workspace.localOnly) void runSync();
  }, [userId]);

  const reload = React.useCallback(async (preferredId?: string) => {
    setReady(false);
    onReady(false);
    try {
      let next: WorkspaceSummary[];
      if (userId) {
        let remote: WorkspaceSummary[];
        try {
          const response = await fetch("/api/workspaces", { cache: "no-store" });
          const body = await response.json() as { workspaces?: WorkspaceSummary[]; error?: string };
          if (!response.ok) throw new Error(body.error ?? t("Could not load workspaces."));
          remote = body.workspaces ?? [];
          await setMeta(remoteWorkspaceListKey(userId), remote);
        } catch (error) {
          remote = await getMeta<WorkspaceSummary[]>(remoteWorkspaceListKey(userId), []);
          if (!remote.length) throw error;
        }
        const deviceOnly = await getMeta<WorkspaceSummary[]>(localWorkspaceListKey(userId), []);
        next = [...remote, ...deviceOnly.filter((local) => !remote.some((workspace) => workspace.id === local.id))];
      } else {
        const local = await getMeta<WorkspaceSummary[]>(localWorkspaceListKey(null), [LOCAL_PERSONAL_WORKSPACE]);
        next = local.length ? local : [LOCAL_PERSONAL_WORKSPACE];
        if (!local.length) await setMeta(localWorkspaceListKey(null), next);
      }
      const selectable = next.filter((workspace) => !workspace.archivedAt);
      if (!selectable.length) throw new Error(t("No active workspace is available."));
      const savedId = preferredId ?? localStorage.getItem(selectedKey(userId)) ?? null;
      const selected = selectable.find((workspace) => workspace.id === savedId)
        ?? selectable.find((workspace) => workspace.isDefault)
        ?? selectable[0];
      setWorkspaces(next);
      activate(selected);
      setLegacyCounts(await countLegacyLocalRows());
      setReady(true);
      onReady(true);
    } catch (error) {
      setWorkspaces([]);
      setActive(null);
      setReady(false);
      onReady(false);
      toast.error(error instanceof Error ? error.message : t("Could not load workspaces."));
    }
  }, [activate, onReady, t, userId]);

  React.useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);

  React.useEffect(() => {
    const refreshList = () => { void reload(); };
    window.addEventListener(WORKSPACES_UPDATED_EVENT, refreshList);
    return () => window.removeEventListener(WORKSPACES_UPDATED_EVENT, refreshList);
  }, [reload]);

  React.useEffect(() => subscribeWorkspaceScope(() => {
    const scope = getWorkspaceScope();
    const match = workspaces.find((workspace) => workspace.id === scope.workspaceId && workspace.ownerUserId === scope.ownerUserId);
    if (match) setActive(match);
  }), [workspaces]);

  const persistLocal = async (next: WorkspaceSummary[]) => {
    setWorkspaces(next);
    await setMeta(localWorkspaceListKey(userId), next);
    announceWorkspaceListChange();
  };

  const createWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      let workspace: WorkspaceSummary;
      if (userId && navigator.onLine) {
        const response = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, kind: newKind }),
        });
        const body = await response.json() as { workspace?: WorkspaceSummary; error?: string };
        if (!response.ok || !body.workspace) throw new Error(body.error ?? t("Workspace could not be created."));
        workspace = body.workspace;
        setWorkspaces((rows) => [...rows, workspace]);
        announceWorkspaceListChange();
      } else {
        workspace = { id: crypto.randomUUID(), ownerUserId: null, name, kind: newKind, isDefault: false, localOnly: true };
        await persistLocal([...workspaces.filter((row) => row.localOnly), workspace]);
        if (userId) toast.message(t("This workspace is stored on this device until you connect it to your account."));
      }
      activate(workspace);
      setNewName("");
      setCreateOpen(false);
      toast.success(t("Workspace created."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Workspace could not be created."));
    } finally { setBusy(false); }
  };

  const updateWorkspace = async (workspace: WorkspaceSummary, change: { name?: string; archive?: boolean }) => {
    setBusy(true);
    try {
      let updated: WorkspaceSummary;
      if (workspace.localOnly) {
        updated = { ...workspace, ...("name" in change ? { name: change.name } : {}), ...(change.archive !== undefined ? { archivedAt: change.archive ? new Date().toISOString() : null } : {}) };
        await persistLocal(workspaces.map((row) => row.id === workspace.id ? updated : row));
      } else {
        const response = await fetch("/api/workspaces", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: workspace.id, ...change }),
        });
        const body = await response.json() as { workspace?: WorkspaceSummary; error?: string };
        if (!response.ok || !body.workspace) throw new Error(body.error ?? t("Workspace could not be updated."));
        updated = body.workspace;
        setWorkspaces((rows) => rows.map((row) => row.id === workspace.id ? updated : row));
        announceWorkspaceListChange();
      }
      if (active?.id === workspace.id && updated.archivedAt) {
        const fallback = workspaces.find((row) => row.isDefault && !row.archivedAt);
        if (fallback) activate(fallback);
      }
      toast.success(change.archive ? t("Workspace archived.") : t("Workspace updated."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Workspace could not be updated."));
    } finally { setBusy(false); }
  };

  const deleteWorkspace = async (workspace: WorkspaceSummary) => {
    setBusy(true);
    try {
      if (workspace.localOnly) {
        if (dbAvailable()) {
          const [records, mutations] = await Promise.all([
            getDB().records.where("workspaceId").equals(workspace.id).count(),
            getDB().outbox.where("workspaceId").equals(workspace.id).count(),
          ]);
          if (records || mutations) throw new Error(t("Workspace contains data. Archive it to keep those records."));
        }
        await persistLocal(workspaces.filter((row) => row.id !== workspace.id));
      } else {
        const response = await fetch(`/api/workspaces?id=${encodeURIComponent(workspace.id)}`, { method: "DELETE" });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? t("Workspace could not be deleted."));
        setWorkspaces((rows) => rows.filter((row) => row.id !== workspace.id));
        announceWorkspaceListChange();
      }
      if (active?.id === workspace.id) {
        const fallback = workspaces.find((row) => row.id !== workspace.id && !row.archivedAt);
        if (fallback) activate(fallback);
      }
      toast.success(t("Workspace deleted."));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Workspace could not be deleted.")); }
    finally { setBusy(false); }
  };

  const importLegacy = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const count = await attachLegacyLocalRows(active.id, active.ownerUserId);
      setLegacyCounts(await countLegacyLocalRows());
      if (active.ownerUserId) await runSync();
      toast.success(t("{count} legacy records associated with {workspace}.", { count, workspace: active.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Legacy records could not be associated."));
    } finally { setBusy(false); }
  };

  const connectLocalWorkspace = async (workspace: WorkspaceSummary) => {
    if (!userId || !workspace.localOnly) return;
    setBusy(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: workspace.id, name: workspace.name, kind: workspace.kind }),
      });
      const body = await response.json() as { workspace?: WorkspaceSummary; error?: string };
      if (!response.ok || !body.workspace) throw new Error(body.error ?? t("Workspace could not be connected."));
      await claimLocalWorkspaceRows(workspace.id, userId);
      const localRows = workspaces.filter((row) => row.localOnly && row.id !== workspace.id);
      await setMeta(localWorkspaceListKey(userId), localRows);
      const remoteRows = [...workspaces.filter((row) => !row.localOnly), body.workspace];
      await setMeta(remoteWorkspaceListKey(userId), remoteRows);
      setWorkspaces(remoteRows);
      activate(body.workspace);
      announceWorkspaceListChange();
      await runSync();
      toast.success(t("Workspace connected to your account."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Workspace could not be connected."));
    } finally { setBusy(false); }
  };

  if (!ready || !active) return (
    <Card className="p-3" aria-live="polite">
      <p className="text-xs text-fg-muted">{t("Loading workspaces…")}</p>
      {!ready ? <Button className="mt-2" size="sm" variant="outline" onClick={() => void reload()}>{t("Retry")}</Button> : null}
    </Card>
  );

  const activeWorkspaces = workspaces.filter((workspace) => !workspace.archivedAt);
  return <>
    <div className="rounded-xl border border-line bg-[var(--surface-strong)] p-2">
      <div className="mb-1 flex items-center gap-0.5 px-0.5">
        <p className="eyebrow text-[9px]">{t("Workspace")}</p>
        <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
          <Tooltip content={t("Workspaces help you keep your personal life, businesses, and projects organized separately within one GridHub account.")}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={t("About workspaces")}
                className="group grid size-11 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors duration-150 hover:text-[var(--accent)] focus-visible:text-[var(--accent)]"
              >
                <InfoIcon size={16} duration={1} color="currentColor" aria-hidden="true" />
              </button>
            </DialogTrigger>
          </Tooltip>
          <DialogContent
            title={t("What are Workspaces?")}
            description={t("Workspaces are separate spaces inside your GridHub account where you can organize your finances, businesses, projects, and everyday work.")}
            className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:max-h-[92dvh]"
          >
            <div className="space-y-5">
              <section className="rounded-2xl border border-line bg-[var(--bg-subtle)]/55 p-4">
                <h3 className="text-sm font-semibold text-fg">{t("One account. Different spaces.")}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{t("Create different workspaces for your personal life, businesses, or brands. Each workspace keeps its own records, so your information stays organized.")}</p>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-fg">{t("How it works")}</h3>
                <div className="space-y-2.5">
                  <WorkspaceInfoStep number="1" icon="plus" title={t("Create a workspace")} description={t("Choose a name such as Personal, My Businesses, or My Projects.")} />
                  <WorkspaceInfoStep number="2" icon="tools" title={t("Add your work")} description={t("Use GridHub tools to create budgets, manage businesses, track projects, organize content, and more.")} />
                  <WorkspaceInfoStep number="3" icon="swap" title={t("Switch anytime")} description={t("Use the workspace selector in the sidebar to move between workspaces. Your records remain in their respective spaces.")} />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-fg">{t("Practical example")}</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <WorkspaceExample title={t("Personal")} items={[t("Monthly budgets"), t("Savings goals"), t("Debt payoff plans")]} />
                  <WorkspaceExample title={t("My Businesses")} items={[t("Poultry farm bookkeeping"), t("Grocery store inventory"), t("Business sales and expenses")]} />
                  <WorkspaceExample title={t("Creative Projects")} items={[t("YouTube content plans"), t("Website development"), t("Marketing campaigns")]} />
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-fg-subtle">{t("One workspace can contain multiple businesses, projects, or plans.")}</p>
              </section>

              <section className="rounded-xl border border-line bg-[var(--bg-subtle)]/45 p-3.5">
                <h3 className="text-[12.5px] font-semibold text-fg">{t("Important to know")}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{t("You don't need multiple workspaces to use GridHub. Your Personal workspace is enough to get started. Create additional workspaces only when you want to keep different areas of your life or work separate.")}</p>
              </section>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setAboutOpen(false)}>{t("Got it")}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setAboutOpen(false);
                  window.setTimeout(() => setCreateOpen(true), 0);
                }}
              >
                {t("Create Workspace")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Dropdown>
        <DropdownTrigger asChild>
          <button type="button" className="press flex w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-[var(--bg-subtle)]" aria-label={t("Switch workspace")}>
            <AnimatedIcon name="layers" size={15} trigger="none" className="shrink-0 text-[var(--accent)]" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg">{active.name}</span>
            <AnimatedIcon name="chevronDown" size={13} trigger="none" className="shrink-0 text-fg-subtle" />
          </button>
        </DropdownTrigger>
        <DropdownContent align="start" className="w-64">
          {activeWorkspaces.map((workspace) => <DropdownItem key={workspace.id} onSelect={() => activate(workspace)}>
            <span className="truncate">{workspace.name}</span>{workspace.isDefault ? <span className="ml-auto text-[10px] text-fg-subtle">{t("Default")}</span> : null}
          </DropdownItem>)}
          <DropdownItem icon="plus" onSelect={() => setCreateOpen(true)}>{t("Create workspace")}</DropdownItem>
          <DropdownItem icon="layers" onSelect={() => setManageOpen(true)}>{t("Manage workspaces")}</DropdownItem>
        </DropdownContent>
      </Dropdown>
      {legacyCounts.records || legacyCounts.mutations ? <button className="mt-1 w-full px-1 text-left text-[10px] text-[var(--accent)]" onClick={() => setManageOpen(true)}>
        {t("{count} legacy local records need review", { count: legacyCounts.records })}
      </button> : null}
    </div>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent title={t("Create workspace")} description={t("Give this workspace a name and choose its type.")}>
        <form onSubmit={createWorkspace} className="flex flex-col gap-3">
          <Field label={t("Workspace name")}><Input autoFocus maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} /></Field>
          <Field label={t("Workspace type")}><Select value={newKind} onChange={(event) => setNewKind(event.target.value as "personal" | "business")}>
            <option value="personal">{t("Personal")}</option><option value="business">{t("Business")}</option>
          </Select></Field>
          <div className="flex justify-end"><Button disabled={busy || !newName.trim()} variant="primary" type="submit">{t("Create workspace")}</Button></div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogContent title={t("Manage workspaces")} description={t("Workspace data stays separate. Sharing with other users is not enabled yet.")}>
        <div className="flex max-h-[58dvh] flex-col gap-3 overflow-y-auto thin-scroll">
          {workspaces.map((workspace) => <WorkspaceManageRow key={`${workspace.id}:${workspace.name}`} workspace={workspace} busy={busy} canConnect={Boolean(userId)} onConnect={() => void connectLocalWorkspace(workspace)} onSave={(name) => updateWorkspace(workspace, { name })} onArchive={() => updateWorkspace(workspace, { archive: true })} onRestore={() => updateWorkspace(workspace, { archive: false })} onDelete={() => void deleteWorkspace(workspace)} />)}
        </div>
        {legacyCounts.records || legacyCounts.mutations ? <div className="mt-4 rounded-xl border border-line p-3">
          <p className="text-xs font-medium text-fg">{t("Legacy local data")}</p>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">{t("These records predate workspace ownership. Associate them with the selected workspace only if they belong to this account. Their IDs and pending changes will be preserved.")}</p>
          <Button className="mt-3" size="sm" variant="secondary" disabled={busy} onClick={() => void importLegacy()}>{t("Associate {count} records with {workspace}", { count: legacyCounts.records, workspace: active.name })}</Button>
        </div> : null}
      </DialogContent>
    </Dialog>
  </>;
}

function WorkspaceInfoStep({ number, icon, title, description }: {
  number: string;
  icon: string;
  title: string;
  description: string;
}) {
  return <div className="flex items-start gap-3 rounded-xl border border-line/80 p-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]" aria-hidden="true">
      <AnimatedIcon name={icon} size={16} trigger="none" />
    </span>
    <div className="min-w-0">
      <p className="text-[12.5px] font-medium text-fg"><span className="mr-1.5 text-fg-subtle">{number}.</span>{title}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-muted">{description}</p>
    </div>
  </div>;
}

function WorkspaceExample({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl border border-line bg-[var(--surface)] p-3">
    <h4 className="text-[12px] font-semibold text-fg">{title}</h4>
    <ul className="mt-2 space-y-1 text-[11px] leading-snug text-fg-muted">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  </div>;
}

function WorkspaceManageRow({ workspace, busy, canConnect, onConnect, onSave, onArchive, onRestore, onDelete }: {
  workspace: WorkspaceSummary;
  busy: boolean;
  canConnect: boolean;
  onConnect: () => void;
  onSave: (name: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState(workspace.name);
  return <div className="rounded-xl border border-line p-3">
    <div className="flex items-start gap-2">
      <Input aria-label={t("Workspace name")} value={name} maxLength={80} disabled={Boolean(workspace.archivedAt) || busy} onChange={(event) => setName(event.target.value)} />
      <Button size="sm" variant="outline" disabled={busy || !name.trim() || name.trim() === workspace.name || Boolean(workspace.archivedAt)} onClick={() => onSave(name.trim())}>{t("Save")}</Button>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] text-fg-subtle">{workspace.kind === "business" ? t("Business") : t("Personal")}{workspace.isDefault ? ` · ${t("Default")}` : ""}{workspace.localOnly ? ` · ${t("Device only")}` : ""}</span>
      <div className="flex gap-1">
        {workspace.localOnly && canConnect ? <Button size="sm" variant="outline" disabled={busy} onClick={onConnect}>{t("Connect to account")}</Button> : null}
        {workspace.archivedAt ? <Button size="sm" variant="ghost" disabled={busy} onClick={onRestore} icon="sync">{t("Restore")}</Button> : null}
        {!workspace.isDefault && !workspace.archivedAt ? <Button size="sm" variant="ghost" disabled={busy} onClick={onArchive} icon="archive">{t("Archive")}</Button> : null}
        {!workspace.isDefault ? <Button size="sm" variant="ghost" className="text-[var(--negative)]" disabled={busy} onClick={onDelete} icon="trash">{t("Delete")}</Button> : null}
      </div>
    </div>
  </div>;
}
