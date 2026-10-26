"use client";

import * as React from "react";
import { RecordForm } from "@/components/data/record-form";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useGridhubAI } from "@/components/ai/ai-provider";
import { TOOL_MAP, TOOLS, type ToolId } from "@/lib/catalog";
import { canUseTool } from "@/lib/ai/permission-checker";
import { useCollection } from "@/lib/store";
import { buildTabs } from "@/lib/tools";
import { useToolData } from "@/lib/use-tool-data";
import type { BaseRecord } from "@/lib/types";

export function QuickAddDialog({
  open,
  onOpenChange,
  onAskAI,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAskAI?: () => void;
}) {
  const { ai, enabled } = useGridhubAI();
  const availableTools = React.useMemo(
    () => TOOLS.filter((tool) => canUseTool(tool.id, ai.entitlement)),
    [ai.entitlement],
  );
  const [requestedTool, setRequestedTool] = React.useState<ToolId>("budget");
  const toolId = availableTools.some((tool) => tool.id === requestedTool)
    ? requestedTool
    : availableTools[0]?.id ?? "budget";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Quick add"
        description="Add a record directly to one of your tools."
        className="max-h-[90dvh]"
      >
        {enabled && onAskAI ? (
          <div className="mb-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon="edit"
              onClick={onAskAI}
            >
              Ask Gridhub AI
            </Button>
          </div>
        ) : null}
        {availableTools.length ? (
          <QuickAddForm
            key={toolId}
            toolId={toolId}
            tools={availableTools.map((tool) => ({ id: tool.id, label: tool.name }))}
            onToolChange={setRequestedTool}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <p className="text-sm text-fg-muted">No tools are available on this plan yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickAddForm({
  toolId,
  tools,
  onToolChange,
  onClose,
}: {
  toolId: ToolId;
  tools: { id: ToolId; label: string }[];
  onToolChange: (toolId: ToolId) => void;
  onClose: () => void;
}) {
  const { data } = useToolData(toolId);
  const tabs = React.useMemo(() => buildTabs(toolId, data).filter((tab) => tab.fields.length > 0), [toolId, data]);
  const defaultTab = tabs.find((tab) => tab.id === "transactions") ?? tabs[0];
  const [requestedTab, setRequestedTab] = React.useState(defaultTab?.id ?? "");
  const selectedTab = tabs.find((tab) => tab.id === requestedTab) ?? defaultTab;
  const { add } = useCollection<BaseRecord>(toolId, selectedTab?.collection ?? "quick-add");

  React.useEffect(() => {
    if (!tabs.some((tab) => tab.id === requestedTab)) setRequestedTab(defaultTab?.id ?? "");
  }, [tabs, requestedTab, defaultTab]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    await add(values as Omit<BaseRecord, "id" | "createdAt" | "updatedAt">);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tool" htmlFor="quick-add-tool">
          <Select
            id="quick-add-tool"
            value={toolId}
            onChange={(event) => onToolChange(event.target.value as ToolId)}
          >
            {tools.map((tool) => (
              <option key={tool.id} value={tool.id}>{tool.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="What to add" htmlFor="quick-add-type">
          <Select
            id="quick-add-type"
            value={selectedTab?.id ?? ""}
            onChange={(event) => setRequestedTab(event.target.value)}
            disabled={tabs.length < 2}
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.addLabel ?? tab.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      {selectedTab ? (
        <RecordForm
          key={`${toolId}:${selectedTab.collection}`}
          open
          embedded
          title={selectedTab.addLabel ?? `Add ${selectedTab.label}`}
          description={TOOL_MAP[toolId].shortName}
          fields={selectedTab.fields}
          initial={selectedTab.defaults}
          onOpenChange={(next) => { if (!next) onClose(); }}
          onSubmit={handleSubmit}
          submitLabel={selectedTab.addLabel ?? "Save record"}
        />
      ) : (
        <p className="rounded-xl border border-line bg-[var(--bg-subtle)] p-3 text-sm text-fg-muted">
          This tool has no quick-add form available.
        </p>
      )}
    </div>
  );
}
