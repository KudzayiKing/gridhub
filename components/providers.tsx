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
  uiLanguageManuallySet: false,
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

function detectBrowserLanguage(): NonNullable<UserPreferences["uiLanguage"]> {
  const languages = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of languages) {
    const language = tag.toLowerCase().split("-")[0];
    if (language === "es") return "es";
    if (language === "zh") return "zh-CN";
    if (language === "pt") return "pt-BR";
    if (language === "fr") return "fr";
    if (language === "ar") return "ar";
    if (language === "ru") return "ru";
    if (language === "en") return "en";
  }
  return "en";
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [prefs, setStoredPrefs, prefsLoading] = useMeta<UserPreferences>("prefs", DEFAULT_PREFS);
  const [sync, setSync] = React.useState<SyncState>({ phase: "local", pending: 0, lastSyncedAt: null });

  // Keep browser and installed-PWA chrome aligned with the page background in the active theme.
  React.useEffect(() => {
    const root = document.documentElement;
    const syncThemeColor = () => {
      const color = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (!color) return;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        meta.content = color;
      });
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const setPrefs = React.useCallback(
    async (patch: Partial<UserPreferences>) => {
      await setStoredPrefs({
        ...prefs,
        ...patch,
        ...(Object.hasOwn(patch, "uiLanguage") ? { uiLanguageManuallySet: true } : {}),
        updatedAt: new Date().toISOString(),
      });
    },
    [prefs, setStoredPrefs],
  );

  // Adopt the browser language until the user explicitly chooses one. The language menu calls
  // setPrefs and records that choice, while device time zone remains a one-time default.
  React.useEffect(() => {
    if (prefsLoading) return;
    const zone = prefs.updatedAt ? prefs.timeZone : deviceTimeZone() ?? prefs.timeZone;
    const language = prefs.uiLanguageManuallySet || Boolean(prefs.uiLanguage && prefs.uiLanguage !== "en")
      ? prefs.uiLanguage ?? "en"
      : detectBrowserLanguage();
    if (zone === prefs.timeZone && language === prefs.uiLanguage) return;
    void setStoredPrefs({
      ...prefs,
      timeZone: zone,
      uiLanguage: language,
      updatedAt: prefs.updatedAt || new Date().toISOString(),
    });
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
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
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
