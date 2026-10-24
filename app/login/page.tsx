"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Button } from "@/components/ui/button";
import { Card, InlineAlert } from "@/components/ui/card";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { toast } from "sonner";
import { usePrefs } from "@/components/providers";
import { Select } from "@/components/ui/field";
import { UI_LANGUAGES, useI18n } from "@/lib/i18n";

/**
 * `useSearchParams()` forces client-side rendering, so during a static build it must sit
 * behind a Suspense boundary or `next build` fails the prerender for `/login`.
 */
export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="self-center">
        <Logo size="lg" />
      </div>
      <Card className="p-6">
        <div className="shimmer h-6 w-52 rounded-md" />
        <div className="shimmer mt-2 h-4 w-full rounded-md" />
        <div className="shimmer mt-5 h-12 w-full rounded-full" />
      </Card>
    </div>
  );
}

function LoginForm() {
  const { prefs, setPrefs } = usePrefs();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const [loading, setLoading] = React.useState(false);
  const configured = isSupabaseConfigured();

  const signIn = async () => {
    if (!configured) {
      router.push("/app");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) toast.error(error.message);
    } catch {
      toast.error("Could not start Google sign-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="press self-center"><Logo size="lg" /></Link>
        <Select aria-label="Interface language" value={prefs.uiLanguage ?? "en"}
          onChange={(event) => void setPrefs({ uiLanguage: event.target.value as typeof prefs.uiLanguage })}
          className="h-8 w-auto min-w-0 rounded-full px-2 text-[11px]">
          {UI_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
        </Select>
      </div>

      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("Welcome to Gridhub.")}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          {t("Sign in to reach your workspace, your tools and your records — on every device.")}
        </p>

        <Button
          variant="secondary"
          size="lg"
          className="mt-5 w-full justify-center"
          onClick={() => void signIn()}
          disabled={loading}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
            </svg>
          </span>
          {loading ? t("Opening Google…") : t("Continue with Google")}
        </Button>

        {!configured ? (
          <div className="mt-4">
            <InlineAlert tone="warning" title="Google sign-in is not configured here">
              Add <code className="text-[11.5px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="text-[11.5px]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to enable it. You can still
              open the workspace in local-only mode.
            </InlineAlert>
            <Button variant="primary" size="md" className="mt-3 w-full" icon="arrowRight" onClick={() => router.push("/app")}>
              Continue in local mode
            </Button>
          </div>
        ) : null}

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-fg-subtle">
          {t("By continuing you agree to the")}{" "}
          <Link href="/terms" className="underline decoration-line-strong underline-offset-2">
            {t("Terms")}
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline decoration-line-strong underline-offset-2">
            {t("Privacy Policy")}
          </Link>
          .
        </p>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-fg-subtle">
        <AnimatedIcon name="lock" size={12} trigger="none" />
        {t("Your records stay yours. Export them any time.")}
      </p>
    </div>
  );
}
