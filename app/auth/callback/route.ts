import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=not_configured", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // First sign-in: ensure a profile row exists. Preferences and the workspace are
  // created by database defaults/triggers, so this is safe to retry.
  if (user) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
      { onConflict: "id" },
    );

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!preferences) {
      return NextResponse.redirect(new URL("/onboarding", url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
