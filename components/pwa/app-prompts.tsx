"use client";

import * as React from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface UpdatePrompt {
  version: string;
  source: "deployment" | "service-worker";
}

const UPDATE_DISMISSED_KEY = "gridhub:update-dismissed";
const INSTALL_DISMISSED_KEY = "gridhub:install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isMobileDevice() {
  const userAgent = navigator.userAgent || "";
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (
    /Android|iPhone|iPad|iPod|IEMobile|Windows Phone/i.test(userAgent) ||
    touchMac ||
    window.matchMedia("(max-width: 767px)").matches
  );
}

function isIOSDevice() {
  const userAgent = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function AppPrompts({ buildVersion }: { buildVersion: string }) {
  const { t } = useI18n();
  const [update, setUpdate] = React.useState<UpdatePrompt | null>(null);
  const [showInstall, setShowInstall] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const registrationRef = React.useRef<ServiceWorkerRegistration | null>(null);
  const versionRef = React.useRef("");

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    const mobile = isMobileDevice();
    const installed = isStandalone();
    const ios = isIOSDevice();
    setIsIOS(ios);

    try {
      setShowInstall(mobile && !installed && localStorage.getItem(INSTALL_DISMISSED_KEY) !== "true");
    } catch {
      setShowInstall(mobile && !installed);
    }

    const onBeforeInstallPrompt = (rawEvent: Event) => {
      rawEvent.preventDefault();
      const event = rawEvent as BeforeInstallPromptEvent;
      setInstallEvent(event);
      try {
        if (mobile && !installed && localStorage.getItem(INSTALL_DISMISSED_KEY) !== "true") {
          setShowInstall(true);
        }
      } catch {
        if (mobile && !installed) setShowInstall(true);
      }
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setShowInstall(false);
      try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
      } catch {
        // The app-installed event still closes this prompt when storage is unavailable.
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const checkVersion = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { version?: string };
        const version = body.version;
        if (!version || disposed) return;
        versionRef.current = version;

        let dismissedVersion = "";
        try {
          dismissedVersion = sessionStorage.getItem(UPDATE_DISMISSED_KEY) ?? "";
        } catch {
          // Treat unavailable session storage as not dismissed.
        }
        if (buildVersion !== version && dismissedVersion !== version && dismissedVersion !== "*") {
          setUpdate({ version, source: "deployment" });
        } else if (buildVersion === version) {
          setUpdate((current) => current?.source === "deployment" ? null : current);
        }
      } catch {
        // Update discovery is progressive; never block workspace use if the endpoint is unavailable.
      }
    };

    const inspectWaitingWorker = () => {
      if (!registration?.waiting || disposed) return;
      const version = versionRef.current || "latest";
      let dismissedVersion = "";
      try {
        dismissedVersion = sessionStorage.getItem(UPDATE_DISMISSED_KEY) ?? "";
      } catch {
        // Treat unavailable session storage as not dismissed.
      }
      if (dismissedVersion !== version && dismissedVersion !== "*") {
        setUpdate({ version, source: "service-worker" });
      }
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", inspectWaitingWorker);
    };

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((readyRegistration) => {
          if (disposed) return;
          registration = readyRegistration;
          registrationRef.current = readyRegistration;
          registration.addEventListener("updatefound", onUpdateFound);
          inspectWaitingWorker();
          return registration.update().catch(() => undefined);
        })
        .catch(() => undefined);
    }

    void checkVersion();
    const poll = window.setInterval(() => void checkVersion(), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
        void registration?.update().catch(() => undefined);
      }
    };
    const onOnline = () => {
      void checkVersion();
      void registration?.update().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, [buildVersion]);

  const dismissInstall = () => {
    setShowInstall(false);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    } catch {
      // The prompt remains dismissed for this mounted session.
    }
  };

  const installApp = async () => {
    if (!installEvent) {
      dismissInstall();
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "accepted") {
      setShowInstall(false);
      try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
      } catch {
        // The browser's appinstalled event will also close the prompt.
      }
    } else {
      dismissInstall();
    }
  };

  const dismissUpdate = () => {
    setUpdate(null);
    try {
      sessionStorage.setItem(UPDATE_DISMISSED_KEY, update?.version || versionRef.current || "*");
    } catch {
      // Keep the prompt dismissed for this mounted session.
    }
  };

  const applyUpdate = () => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }

    let didReload = false;
    const reload = () => {
      if (didReload) return;
      didReload = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    waiting.postMessage("SKIP_WAITING");
    window.setTimeout(reload, 4000);
  };

  const showUpdate = Boolean(update);
  if (!showUpdate && !showInstall) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] z-[45] mx-auto max-w-md sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0"
    >
      <div className="glass-strong rounded-[22px] border border-line p-4 shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-3">
          <Wordmark size="md" />
          <button
            type="button"
            onClick={showUpdate ? dismissUpdate : dismissInstall}
            aria-label={t("Dismiss prompt")}
            className="-mr-2 -mt-2 grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-[var(--bg-subtle)] hover:text-fg"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {showUpdate ? (
          <>
            <h2 className="mt-3 text-[14px] font-semibold">{t("A new Gridhub update is ready")}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
              {t("Reload to get the latest improvements. Your workspace is saved before the app refreshes.")}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={dismissUpdate}>Later</Button>
              <Button variant="primary" size="sm" icon="refresh" onClick={applyUpdate}>Update now</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-[14px] font-semibold">{t("Add Gridhub to your Home Screen")}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
              {t("Keep your workspace one tap away as an app on your phone.")}
            </p>
            {!installEvent ? (
              <p className="mt-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-[11.5px] leading-relaxed text-fg-muted">
                {isIOS
                  ? t("Tap Share in your browser, then choose Add to Home Screen.")
                  : t("Open your browser menu and choose Install app or Add to Home Screen.")}
              </p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={dismissInstall}>Not now</Button>
              {installEvent ? (
                <Button variant="primary" size="sm" icon="download" onClick={() => void installApp()}>
                  Install app
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
