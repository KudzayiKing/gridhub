import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingMutation {
  id: string;
  toolId: string;
  collection: string;
  recordId: string;
  op: "upsert" | "delete";
  payload: Record<string, unknown>;
  createdAt: string;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function authenticate(request: Request) {
  const configured = adminClient();
  if (!configured) return { error: "Supabase is not configured", status: 501 as const };

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Missing bearer token", status: 401 as const };

  const supabase = createClient(configured.url, configured.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return { error: "Invalid session", status: 401 as const };
  return { supabase, user };
}

/**
 * Push local mutations.
 *
 * Idempotency: each mutation carries a client-generated id which is stored as a
 * primary key, so a retried batch cannot apply twice. Records carry a version;
 * a lower-or-equal version from the client is rejected as a conflict rather than
 * overwriting a newer server row (financial records must never be silently clobbered).
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { mutations?: IncomingMutation[] };
  try {
    body = (await request.json()) as { mutations?: IncomingMutation[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mutations = body.mutations ?? [];
  if (!Array.isArray(mutations) || mutations.length === 0) {
    return NextResponse.json({ acked: [], serverTime: new Date().toISOString() });
  }
  if (mutations.length > 100) {
    return NextResponse.json({ error: "Batch too large (max 100)" }, { status: 413 });
  }

  const { supabase, user } = auth;
  const acked: string[] = [];
  const conflicts: { recordId: string; reason: string }[] = [];

  for (const mutation of mutations) {
    const version = Number((mutation.payload as { version?: number })?.version ?? 1);
    if (!mutation.id || !mutation.recordId || !mutation.toolId || !mutation.collection ||
        !Number.isInteger(version) || version < 1 || !["upsert", "delete"].includes(mutation.op)) {
      conflicts.push({ recordId: mutation.recordId ?? "", reason: "invalid-mutation" });
      continue;
    }

    const { data: applied, error } = await supabase.rpc("upsert_sync_record_if_newer", {
      p_user_id: user.id,
      p_record_id: mutation.recordId,
      p_tool_id: mutation.toolId,
      p_collection: mutation.collection,
      p_data: mutation.payload,
      p_deleted: mutation.op === "delete",
      p_version: version,
      p_client_mutation_id: mutation.id,
    });

    if (error) {
      console.error("Sync mutation could not be applied:", error.message);
      conflicts.push({ recordId: mutation.recordId, reason: "sync-write-failed" });
    } else if (applied) {
      acked.push(mutation.id);
    } else {
      conflicts.push({ recordId: mutation.recordId, reason: "server-version-newer" });
    }
  }

  return NextResponse.json({ acked, conflicts, serverTime: new Date().toISOString() });
}

/** Pull changes since a cursor (ISO timestamp). */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabase, user } = auth;
  const since = new URL(request.url).searchParams.get("since") ?? "";

  let query = supabase
    .from("sync_records")
    .select("record_id, tool_id, collection, data, deleted, version, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: true })
    .limit(500);

  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not read changes" }, { status: 500 });

  const changes = (data ?? []).map((row) => ({
    id: row.record_id as string,
    toolId: row.tool_id as string,
    collection: row.collection as string,
    data: row.data as Record<string, unknown>,
    deleted: Boolean(row.deleted),
    version: Number(row.version ?? 1),
    updatedAt: row.updated_at as string,
  }));

  return NextResponse.json({
    changes,
    cursor: changes.at(-1)?.updatedAt ?? since,
  });
}
