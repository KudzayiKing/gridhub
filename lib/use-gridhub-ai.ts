"use client";

/**
 * Gridhub AI — the orchestration hook.
 *
 * This is the only place that sequences the pipeline:
 *   text/voice → route → validate → authorize → resolve → confirm → commit
 *
 * It never touches the database itself. Writes go through `PreparedAction.commit`, which uses the
 * same repository as the manual UI, so the existing outbox and sync engine handle them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePrefs } from "@/components/providers";
import { useActiveTools } from "@/lib/use-tools";
import { todayISO, deviceTimeZone } from "@/lib/utils";
import { routeCommand } from "@/lib/ai/command-router";
import {
  isClarification,
  prepareAction,
  runQuery,
  type ExecResult,
  type PreparedAction,
  type QueryResult,
} from "@/lib/ai/action-executor";
import { actionsForTools } from "@/lib/ai/action-registry";
import { allowedToolIds, type EntitlementState } from "@/lib/ai/permission-checker";
import { appendAIHistory, clearAIHistory, readAIHistory, type AIHistoryEntry } from "@/lib/ai/ai-privacy";
import type { PlanId } from "@/lib/plans";
import { elapsedMs, logAIDiagnostic } from "@/lib/ai/diagnostics";

export type AIPhase = "idle" | "thinking" | "review" | "done" | "error";

export interface ClarificationState {
  question: string;
  options?: string[];
}

interface EntitlementsResponse {
  configured?: boolean;
  plan?: string | null;
  tools?: string[];
  status?: string;
}

const PLAN_IDS: PlanId[] = ["free", "single", "plus", "pro", "unlimited"];

function toPlanId(value: unknown): PlanId {
  return typeof value === "string" && (PLAN_IDS as string[]).includes(value)
    ? (value as PlanId)
    : "free";
}

export interface GridhubAIController {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;

  phase: AIPhase;
  transcript: string;
  setTranscript: (value: string) => void;
  /** The command that produced the current proposal, used for clarifications. */
  lastCommand: string;
  proposal: PreparedAction | null;
  query: QueryResult | null;
  clarification: ClarificationState | null;
  note: string | null;
  error: string | null;
  result: ExecResult | null;

  busy: boolean;
  submit: (text?: string) => Promise<void>;
  confirm: () => Promise<void>;
  discard: () => void;
  choose: (option: string) => Promise<void>;
  undo: () => Promise<void>;
  reset: () => void;
  cancel: () => void;

  examples: string[];
  entitlement: EntitlementState;
  /** True when the local model is not installed, so only deterministic commands work. */
  deterministicOnly: boolean;
  history: AIHistoryEntry[];
  clearHistory: () => void;
  refreshHistory: () => void;
}

export interface UseGridhubAIOptions {
  /** Whether the local model is cached and ready. */
  modelReady: boolean;
}

export function useGridhubAIController({ modelReady }: UseGridhubAIOptions): GridhubAIController {
  const router = useRouter();
  const { prefs } = usePrefs();
  const { active } = useActiveTools();

  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<AIPhase>("idle");
  const [transcript, setTranscript] = React.useState("");
  const [lastCommand, setLastCommand] = React.useState("");
  const [proposal, setProposal] = React.useState<PreparedAction | null>(null);
  const [query, setQuery] = React.useState<QueryResult | null>(null);
  const [clarification, setClarification] = React.useState<ClarificationState | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ExecResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  /*
   * Lazy initialiser rather than an effect: reading localStorage on mount and calling setState is a
   * cascading render. On the server this yields [] and nothing history-shaped is rendered until the
   * panel opens, so there is no hydration mismatch.
   */
  const [history, setHistory] = React.useState<AIHistoryEntry[]>(() =>
    typeof window === "undefined" ? [] : readAIHistory(),
  );

  const [server, setServer] = React.useState<EntitlementsResponse | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Entitlements are fetched once; a failure degrades to local activation rather than blocking.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/entitlements")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: EntitlementsResponse | null) => {
        if (alive) setServer(body);
      })
      .catch(() => {
        if (alive) setServer({ configured: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  const entitlement = React.useMemo<EntitlementState>(() => {
    const configured = Boolean(server?.configured);
    const entitled = Array.isArray(server?.tools) ? (server!.tools as string[]) : [];
    return {
      plan: toPlanId(server?.plan),
      entitledTools: entitled as EntitlementState["entitledTools"],
      activeTools: active,
      configured,
    };
  }, [server, active]);

  const deterministicOnly = !modelReady;

  /**
   * Examples are generated from the actions this account can actually use. Showing an example that
   * would then be refused would be worse than showing fewer examples.
   */
  const examples = React.useMemo(() => {
    const allowed = new Set(allowedToolIds(entitlement));
    const actions = actionsForTools([...allowed]);
    const activeSet = new Set(active);
    const ranked = [...actions].sort((a, b) => {
      const aActive = activeSet.has(a.toolId) ? 0 : 1;
      const bActive = activeSet.has(b.toolId) ? 0 : 1;
      return aActive - bActive;
    });
    const picked: string[] = [];
    for (const action of ranked) {
      const example = action.examples[0];
      if (example && !picked.includes(example)) picked.push(example);
      if (picked.length >= 4) break;
    }
    return picked;
  }, [entitlement, active]);

  const execContext = React.useMemo(
    () => ({
      entitlement,
      today: todayISO(),
      // Never tell the model "UTC" by accident: `todayISO()` is the device's local date, so a UTC
      // label alongside it would make the model reason about the wrong day.
      timeZone: prefs.timeZone || deviceTimeZone(),
      currency: prefs.currency || "USD",
    }),
    [entitlement, prefs.timeZone, prefs.currency],
  );

  const reset = React.useCallback(() => {
    setPhase("idle");
    setProposal(null);
    setQuery(null);
    setClarification(null);
    setNote(null);
    setError(null);
    setResult(null);
    setBusy(false);
  }, []);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset]);

  const record = React.useCallback(
    (text: string, outcome: string, toolId?: string, source: AIHistoryEntry["source"] = "text") => {
      setHistory(appendAIHistory({ text, outcome, toolId, source }));
    },
    [],
  );

  const submit = React.useCallback(
    async (value?: string) => {
      const text = (value ?? transcript).trim();
      if (!text || busy) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setTranscript(text);
      setLastCommand(text);
      setBusy(true);
      setPhase("thinking");
      setProposal(null);
      setQuery(null);
      setClarification(null);
      setNote(null);
      setError(null);
      setResult(null);

      try {
        const commandStarted = performance.now();
        const routed = await routeCommand(text, {
          entitlement,
          today: execContext.today,
          timeZone: execContext.timeZone,
          locale: prefs.locale || undefined,
          signal: ac.signal,
          deterministicOnly,
        });
        logAIDiagnostic("command-routed", {
          durationMs: elapsedMs(commandStarted),
          routeKind: routed.kind,
          routeSource: routed.kind === "proposal" ? routed.source : undefined,
          deterministicOnly,
        });

        if (ac.signal.aborted) return;

        if (routed.kind === "clarification") {
          setClarification({ question: routed.question, options: routed.options });
          setPhase("review");
          return;
        }
        if (routed.kind === "unsupported") {
          setNote(routed.reason ?? "I can't help with that yet.");
          setPhase("done");
          return;
        }
        if (routed.kind === "error") {
          setError(routed.message);
          setPhase("error");
          return;
        }

        const proposalData = routed.proposal;

        if (proposalData.intent === "navigation" && proposalData.path) {
          setNote("Opening that for you.");
          setPhase("done");
          router.push(proposalData.path);
          record(text, "Opened a page", undefined, routed.source);
          return;
        }

        if (proposalData.intent === "clarification") {
          setClarification({
            question: proposalData.question ?? "Could you give me a bit more detail?",
            options: proposalData.options,
          });
          setPhase("review");
          return;
        }

        if (proposalData.intent === "unsupported") {
          setNote(proposalData.reason ?? "I can't help with that yet.");
          setPhase("done");
          return;
        }

        if (proposalData.intent === "query") {
          const answer = await runQuery(proposalData.actionId, proposalData.parameters ?? {}, execContext);
          if (ac.signal.aborted) return;
          // A query can also come back asking for a date it could not read, rather than silently
          // answering about today.
          if (isClarification(answer)) {
            setClarification({ question: answer.question, options: answer.options });
            setPhase("review");
            return;
          }
          setQuery(answer);
          setPhase("done");
          record(text, answer.title, undefined, routed.source);
          return;
        }

        if (proposalData.intent === "action" && proposalData.actionId) {
          const prepareStarted = performance.now();
          const prepared = await prepareAction(
            proposalData.actionId,
            proposalData.parameters ?? {},
            execContext,
          );
          logAIDiagnostic("action-prepared", {
            durationMs: elapsedMs(prepareStarted),
            kind: prepared.kind,
            actionId: proposalData.actionId,
          });
          if (ac.signal.aborted) return;
          if (prepared.kind === "clarification") {
            setClarification({ question: prepared.question, options: prepared.options });
            setPhase("review");
            return;
          }
          setProposal(prepared);
          setPhase("review");
          return;
        }

        setNote("I couldn't turn that into an action. Try rephrasing it.");
        setPhase("done");
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      } finally {
        if (!ac.signal.aborted) setBusy(false);
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [transcript, busy, entitlement, execContext, prefs.locale, deterministicOnly, router, record],
  );

  const confirm = React.useCallback(async () => {
    if (!proposal) return;
    setBusy(true);
    const commitStarted = performance.now();
    try {
      const outcome = await proposal.commit();
      logAIDiagnostic("action-commit-complete", {
        durationMs: elapsedMs(commitStarted),
        ok: outcome.ok,
        toolId: outcome.toolId,
      });
      setResult(outcome);
      setPhase(outcome.ok ? "done" : "error");
      if (!outcome.ok) setError(outcome.message);
      record(lastCommand, outcome.message, outcome.toolId, "text");
      setProposal(null);
    } catch (err) {
      logAIDiagnostic("action-commit-failed", {
        durationMs: elapsedMs(commitStarted),
        errorName: err instanceof Error ? err.name : "unknown",
      });
      setError(err instanceof Error ? err.message : "The change could not be saved.");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }, [proposal, lastCommand, record]);

  const undo = React.useCallback(async () => {
    const fn = result?.undo;
    if (!fn) return;
    try {
      await fn();
      setResult(null);
      setPhase("idle");
      setNote("That change was removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The change could not be undone.");
    }
  }, [result]);

  const discard = React.useCallback(() => {
    setProposal(null);
    setClarification(null);
    setPhase("idle");
  }, []);

  const choose = React.useCallback(
    async (option: string) => {
      // Re-run with the disambiguation appended so the router (or model) sees the chosen entity.
      const base = lastCommand || transcript;
      await submit(`${base} (${option})`);
    },
    [lastCommand, transcript, submit],
  );

  const openPanel = React.useCallback(() => {
    setOpen(true);
    setPhase((p) => (p === "thinking" ? p : "idle"));
  }, []);

  const closePanel = React.useCallback(() => {
    setOpen(false);
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    if (phase === "thinking") setPhase("idle");
  }, [phase]);

  const refreshHistory = React.useCallback(() => setHistory(readAIHistory()), []);

  const clearHistory = React.useCallback(() => {
    clearAIHistory();
    setHistory([]);
  }, []);

  return {
    open,
    openPanel,
    closePanel,
    phase,
    transcript,
    setTranscript,
    lastCommand,
    proposal,
    query,
    clarification,
    note,
    error,
    result,
    busy,
    submit,
    confirm,
    discard,
    choose,
    undo,
    reset,
    cancel,
    examples,
    entitlement,
    deterministicOnly,
    history,
    clearHistory,
    refreshHistory,
  };
}
