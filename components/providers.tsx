"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlay";
import { useMeta } from "@/lib/store";
import { runSync, subscribeSync, type SyncState } from "@/lib/sync";
import { deviceTimeZone } from "@/lib/utils";
import type { UserPreferences } from "@/lib/types";

const DEFAULT_PREFS: UserPreferences = {
  id: "prefs",
  currency: "USD",
  locale: "en-US",
  uiLanguage: "en",
  dateFormat: "MM/DD/YYYY",
  // Deterministic for SSR: the server and the first client render must agree, and the server has
  // no idea what zone the browser is in. The real default is adopted from the device in the effect
  // below, before any preference has been saved.
  timeZone: "UTC",
  theme: "system",
  reducedMotion: false,
  createdAt: "",
  updatedAt: "",
};

interface PrefsContextValue {
  prefs: UserPreferences;
  setPrefs: (patch: Partial<UserPreferences>) => Promise<void>;
  loading: boolean;
}

const PrefsContext = React.createContext<PrefsContextValue>({
  prefs: DEFAULT_PREFS,
  setPrefs: async () => {},
  loading: true,
});

const SyncContext = React.createContext<SyncState>({
  phase: "local",
  pending: 0,
  lastSyncedAt: null,
});

export function usePrefs() {
  return React.useContext(PrefsContext);
}

export function useSyncState() {
  return React.useContext(SyncContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [prefs, setStoredPrefs, prefsLoading] = useMeta<UserPreferences>("prefs", DEFAULT_PREFS);
  const [sync, setSync] = React.useState<SyncState>({ phase: "local", pending: 0, lastSyncedAt: null });

  const setPrefs = React.useCallback(
    async (patch: Partial<UserPreferences>) => {
      await setStoredPrefs({ ...prefs, ...patch, updatedAt: new Date().toISOString() });
    },
    [prefs, setStoredPrefs],
  );

  // Adopt the device time zone until the user has saved preferences of their own.
  //
  // `updatedAt` is the "has anything ever been saved" marker: it is empty on a freshly seeded
  // record and set by every `setPrefs` call. Gating on it means a zone the user picked — including
  // a deliberate "UTC" — is never overwritten on the next load.
  React.useEffect(() => {
    if (prefsLoading) return;
    if (prefs.updatedAt) return;
    const zone = deviceTimeZone();
    if (!zone || zone === prefs.timeZone) return;
    void setStoredPrefs({ ...prefs, timeZone: zone, updatedAt: new Date().toISOString() });
  }, [prefsLoading, prefs, setStoredPrefs]);

  // Service worker + sync triggers
  React.useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        /* offline support is progressive; never block the app */
      });
    }

    const unsub = subscribeSync(setSync);
    void runSync();

    const onOnline = () => void runSync();
    const onOffline = () => void runSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Reduced-motion preference is additive to the OS setting.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("reduce-motion", prefs.reducedMotion);
  }, [prefs.reducedMotion]);

  React.useEffect(() => {
    const language = prefs.uiLanguage ?? "en";
    document.documentElement.lang = language;
    document.documentElement.dataset.uiLanguage = language;
  }, [prefs.uiLanguage]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PrefsContext.Provider value={{ prefs, setPrefs, loading: prefsLoading }}>
        <SyncContext.Provider value={sync}>
          <TooltipProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: "glass-strong !rounded-xl !text-fg",
              }}
            />
          </TooltipProvider>
        </SyncContext.Provider>
      </PrefsContext.Provider>
    </ThemeProvider>
  );
}
