import { NextResponse } from "next/server";
import { getSessionUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";

/**
 * Permanently delete the signed-in user's account.
 *
 * Every customer-owned table in `supabase/migrations/0001_init.sql` declares
 * `references auth.users(id) on delete cascade`, so removing the auth user removes the
 * profile, workspaces, preferences, billing rows and all sixteen tools' records in one
 * statement. We deliberately do not enumerate table names here: a hand-maintained list
 * would silently drift as tools are added, leaving orphans behind.
 *
 * What this does NOT delete, and we say so rather than implying otherwise:
 *   - Stripe customers, invoices and payment history. Those are Stripe's records of a
 *     financial transaction and are retained under Stripe's own policy; deleting them
 *     from our side would not erase them, and would break the user's receipts.
 *   - Anything still sitting in a browser's IndexedDB. The client clears it after a
 *     successful response (see `app/app/settings/page.tsx`); a user who never returns
 *     to the page keeps a stale local copy, which is why the UI asks them to export or
 *     clear cache deliberately.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Account deletion needs Supabase to be configured. This build is running in local-only mode, so there is no server-side account to delete — clear local data from Settings instead.",
      },
      { status: 501 },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    // Deliberately a configuration error, not a silent no-op. Claiming success here
    // would be the worst possible outcome: the user believes their data is gone.
    return NextResponse.json(
      {
        error:
          "Account deletion is not configured: SUPABASE_SERVICE_ROLE_KEY is missing on the server. Nothing was deleted.",
      },
      { status: 501 },
    );
  }

  const { error } = await service.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("[gridhub/account-delete] failed", { userId: user.id, error: error.message });
    return NextResponse.json(
      { error: `Could not delete the account: ${error.message}. Nothing was deleted.` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedUserId: user.id,
    retained: "Stripe invoices and payment history are retained by Stripe under their policy.",
  });
}
