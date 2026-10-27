"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlay";
import { useMeta } from "@/lib/store";
import { flattenOver } from "@/lib/color";
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

/**
 * OS chrome — the status bar and the home-indicator strip — is painted by the platform, above
 * our content. No CSS can blur it, and there is no "transparent" option: Android Chrome paints
 * `theme-color` as a flat band, and iOS's `black-translucent` status bar forces white glyphs,
 * which are unreadable on the light theme. The most a web app can do is make its colour *equal*
 * the glass band sitting next to it, so the seam disappears and the bar reads as the top of the
 * glass instead of a flat lid.
 *
 * `--chrome-solid` is that colour: the chrome fill composited over the canvas. The scrims in
 * globals.css fade from the same token, so the two cannot drift. When the token is missing,
 * fall back to computing the composite from `--header` rather than guessing.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [prefs, setStoredPrefs, prefsLoading] = useMeta<UserPreferences>("prefs", DEFAULT_PREFS);
  const [sync, setSync] = React.useState<SyncState>({ phase: "local", pending: 0, lastSyncedAt: null });

  // Keep the OS-painted browser and installed-PWA chrome flush with the glass header that sits
  // directly beneath it. Sampling `--bg` alone left a visible step: the header is a translucent
  // wash over that background, so the platform bar has to be told the composited colour.
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const syncThemeColor = () => {
      const styles = getComputedStyle(root);
      const page = styles.getPropertyValue("--bg").trim();
      const solid = styles.getPropertyValue("--chrome-solid").trim();
      const header = styles.getPropertyValue("--header").trim();
      const color = solid || (header && flattenOver(header, page)) || page;
      if (!color) return;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        if (meta.content !== color || meta.media) {
          meta.content = color;
          meta.removeAttribute("media");
        }
      });
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    // App Router navigation can replace metadata nodes with the server-rendered default.
    // Reapply the user's active theme immediately so the PWA status bar does not flash
    // the wrong contrast (for example black icons over the dark canvas).
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content", "media", "name"],
    });
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
