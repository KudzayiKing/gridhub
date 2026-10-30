"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePrefs } from "@/components/providers";
import { useActiveTools } from "@/lib/use-tools";
import { useSyncState } from "@/components/providers";
import { CURRENCIES } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge, Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/overlay";
import { getDB, dbAvailable } from "@/lib/db";
import { runSync } from "@/lib/sync";
import { downloadFile } from "@/lib/utils";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UI_LANGUAGES, useI18n } from "@/lib/i18n";
import { PHASE_COPY } from "@/components/shell/sync-indicator";

/** Theme choices. `label` is the English source string, resolved with `t()` at render time. */
const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export default function SettingsPage() {
  const { prefs, setPrefs } = usePrefs();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { active } = useActiveTools();
  const sync = useSyncState();
  const router = useRouter();
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const exportAll = async () => {
    if (!dbAvailable()) return;
    const rows = await getDB().records.toArray();
    downloadFile(
      `gridhub-export-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), records: rows.map((r) => r.data) }, null, 2),
      "application/json",
    );
    toast.success(t("Export downloaded"));
  };

  const clearLocal = async () => {
    if (!dbAvailable()) return;
    await getDB().records.clear();
    await getDB().outbox.clear();
    toast.success(t("Local cache cleared"));
    setConfirmClear(false);
    router.refresh();
  };

  const deleteAccount = async () => {
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? t("Account deletion is not configured."));
        return;
      }
      if (dbAvailable()) {
        await getDB().records.clear();
        await getDB().outbox.clear();
        await getDB().meta.clear();
      }
      if (isSupabaseConfigured()) await getSupabaseBrowserClient()?.auth.signOut();
      router.push("/");
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading eyebrow="Workspace" title="Settings" description={t("Preferences apply to this workspace and stay available offline.")} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Appearance")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">{t("Theme and motion.")}</p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px]">{t("Theme")}</span>
              <div className="flex gap-1">
                {/*
                 * The loop variable used to be named `t`, shadowing the translator, so the
                 * buttons rendered the raw keys "light" / "dark" / "system" in every language.
                 */}
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={theme === option.value ? "primary" : "outline"}
                    onClick={() => {
                      setTheme(option.value);
                      void setPrefs({ theme: option.value });
                    }}
                  >
                    {t(option.label)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px]">{t("Reduce motion")}</p>
                <p className="text-[11.5px] text-fg-subtle">{t("Icon animations and transitions are disabled.")}</p>
              </div>
              <Switch checked={prefs.reducedMotion} onCheckedChange={(v) => void setPrefs({ reducedMotion: v })} aria-label={t("Reduce motion")} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Preferences")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">{t("Used for formatting across every tool.")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Currency" htmlFor="currency">
              <Select id="currency" value={prefs.currency} onChange={(e) => void setPrefs({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date format" htmlFor="dateFormat">
              <Select
                id="dateFormat"
                value={prefs.dateFormat}
                onChange={(e) => void setPrefs({ dateFormat: e.target.value as typeof prefs.dateFormat })}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </Field>
            <Field label="Number and date locale" htmlFor="locale">
              <Input id="locale" value={prefs.locale} onChange={(e) => void setPrefs({ locale: e.target.value })} placeholder="en-US" />
            </Field>
            <Field label="Time zone" htmlFor="tz">
              <Input id="tz" value={prefs.timeZone} onChange={(e) => void setPrefs({ timeZone: e.target.value })} placeholder="Africa/Lagos" />
            </Field>
            <Field label="Interface language" htmlFor="uiLanguage">
              <Select id="uiLanguage" value={prefs.uiLanguage ?? "en"} onChange={(e) => void setPrefs({ uiLanguage: e.target.value as typeof prefs.uiLanguage })}>
                {UI_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
              </Select>
              <p className="text-[11.5px] text-fg-subtle">{t("Text commands recognize supported phrases in your interface language.")}</p>
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("My tools")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">{active.length} {t("tools activated.")}</p>
          <Button variant="secondary" size="sm" className="mt-3" icon="tools" asChild>
            <Link href="/app/tools">{t("Manage tools")}</Link>
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Gridhub AI")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {t("Voice and natural-language commands, running on this device.")}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" icon="settings" asChild>
            <Link href="/app/settings/ai">{t("Manage Gridhub AI")}</Link>
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Data & privacy")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {t("Your records live on this device first. Export any time — including after cancelling.")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon="download" onClick={() => void exportAll()}>
              {t("Export all data")}
            </Button>
            <Button variant="ghost" size="sm" icon="sync" onClick={() => void runSync()}>
              {t("Sync now")}
            </Button>
            <Button variant="ghost" size="sm" icon="trash" onClick={() => setConfirmClear(true)}>
              {t("Clear local cache")}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11.5px] text-fg-subtle">
            <Badge tone={sync.phase === "synced" ? "positive" : "neutral"}>{t(PHASE_COPY[sync.phase].label)}</Badge>
            {sync.pending > 0 ? <span>{sync.pending} {t("changes waiting to sync")}</span> : <span>{t("No pending changes")}</span>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Account")}</h2>
        {!isSupabaseConfigured() ? (
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {t("Supabase is not configured in this environment, so you are working in local-only mode.")}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon="logout"
            onClick={async () => {
              if (isSupabaseConfigured()) await getSupabaseBrowserClient()?.auth.signOut();
              router.push("/");
            }}
          >
            {t("Sign out")}
          </Button>
          <Button variant="ghost" size="sm" icon="alert" className="text-[var(--negative)]" onClick={() => setConfirmDelete(true)}>
            {t("Delete account")}
          </Button>
        </div>
      <InlineAlert tone="info" title="What deletion does" >
          {t("Your workspace records and local cache are removed. Billing records required for tax and accounting are retained by Stripe according to their policy.")}
        </InlineAlert>
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this device's cache?"
        description="Records stored locally on this device will be removed. If they have not synced, they cannot be recovered. Export first."
        confirmLabel="Clear cache"
        onConfirm={() => void clearLocal()}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your account?"
        description="This removes your workspace and records. This cannot be undone."
        confirmLabel="Delete account"
        onConfirm={() => void deleteAccount()}
      />
    </div>
  );
}
