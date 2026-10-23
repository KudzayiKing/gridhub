import { AppShell } from "@/components/shell/app-shell";
import { GridhubAIProvider } from "@/components/ai/ai-provider";
import { getSessionUser, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = isSupabaseConfigured() ? await getSessionUser() : null;

  return (
    <GridhubAIProvider>
      <AppShell
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
