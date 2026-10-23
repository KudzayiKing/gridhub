import { AppShell } from "@/components/shell/app-shell";
import { GridhubAIProvider } from "@/components/ai/ai-provider";
import { getSessionUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { recordCountryActivity } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = isSupabaseConfigured() ? await getSessionUser() : null;
  const buildVersion =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "local";

  if (user) {
    const requestHeaders = await headers();
    // These headers are set by the hosting edge. No IP address is read or persisted.
    const countryCode = [
      requestHeaders.get("x-vercel-ip-country"),
      requestHeaders.get("cf-ipcountry"),
      requestHeaders.get("cloudfront-viewer-country"),
    ]
      .find((value) => value && /^[A-Za-z]{2}$/.test(value))
      ?.toUpperCase();

    if (countryCode) {
      try {
        await recordCountryActivity(user.id, countryCode);
      } catch (error) {
        console.error("Country activity could not be recorded:", error);
      }
    }
  }

  return (
    <GridhubAIProvider>
      <AppShell
        buildVersion={buildVersion}
        user={
          user
            ? {
                email: user.email,
                name:
                  (user.user_metadata?.full_name as string | undefined) ??
                  (user.user_metadata?.name as string | undefined) ??
                  user.email,
              }
            : null
        }
      >
        {children}
      </AppShell>
    </GridhubAIProvider>
  );
}
