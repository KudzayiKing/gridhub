import { getSessionUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";

/**
 * Admin authorization.
 *
 * Deliberately an env allowlist rather than a `profiles.role` column: a role column that
 * can be written by the same RLS policy that lets users update their own profile is an
 * obvious privilege-escalation path. An env allowlist can only be changed by someone who
 * can already deploy. If Gridhub ever needs multiple admin tiers, this is the one place
 * to change.
 *
 * Authorization is enforced in `app/admin/layout.tsx` on the server for every nested
 * route. The pages themselves never decide whether the caller is allowed in.
 */

export type AdminCheck =
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | { status: "forbidden"; email: string | null }
  | { status: "allowed"; userId: string; email: string | null };

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function getAdminCheck(): Promise<AdminCheck> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const user = await getSessionUser();
  if (!user) return { status: "anonymous" };

  if (!isAdminEmail(user.email)) return { status: "forbidden", email: user.email ?? null };

  return { status: "allowed", userId: user.id, email: user.email ?? null };
}

/** True when the service-role key is present, i.e. admin pages can read across users. */
export function serviceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CountResult {
  count: number | null;
  error: string | null;
}

/**
 * Exact row count for a table. Returns an explicit error instead of 0 so the UI can say
 * "could not read" rather than silently rendering a misleading zero.
 *
 * Accepts one equality filter or a list of them (combined with AND).
 */
export async function tableCount(
  table: string,
  filters?:
    | { column: string; value: string | boolean }
    | { column: string; value: string | boolean }[],
): Promise<CountResult> {
  const service = getServiceClient();
  if (!service) return { count: null, error: "Service role key not configured" };

  let query = service.from(table).select("*", { count: "exact", head: true });

  const list = filters ? (Array.isArray(filters) ? filters : [filters]) : [];
  for (const f of list) query = query.eq(f.column, f.value);

  const { count, error } = await query;
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}

export interface RowsResult<T> {
  rows: T[];
  error: string | null;
}

/** Select rows for an admin table view. `limit` is capped so a stray query cannot page the whole DB. */
export async function tableRows<T>(
  table: string,
  options: {
    columns?: string;
    orderBy?: string;
    ascending?: boolean;
    limit?: number;
  } = {},
): Promise<RowsResult<T>> {
  const service = getServiceClient();
  if (!service) return { rows: [], error: "Service role key not configured" };

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  let query = service.from(table).select(options.columns ?? "*").limit(limit);
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false });

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as T[], error: null };
}
