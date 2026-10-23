import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server only. Never import this from a client component and
 * never expose the service key to the browser.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
