import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function authorizedClient() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "Workspace service is not configured." }, { status: 501 }) };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Sign in to manage workspaces." }, { status: 401 }) };
  return { supabase, user };
}

export async function GET() {
  const auth = await authorizedClient();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from("workspaces")
    .select("id, owner_id, name, kind, created_at, is_default, archived_at")
    .eq("owner_id", auth.user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load workspaces. Apply the workspace foundation migration and retry." }, { status: 503 });
  return NextResponse.json({ workspaces: (data ?? []).map((workspace) => ({
    id: workspace.id,
    ownerUserId: workspace.owner_id,
    name: workspace.name,
    kind: workspace.kind,
    createdAt: workspace.created_at,
    isDefault: workspace.is_default,
    archivedAt: workspace.archived_at,
  })) });
}

export async function POST(request: Request) {
  const auth = await authorizedClient();
  if ("error" in auth) return auth.error;
  let body: { id?: string; name?: string; kind?: "personal" | "business" };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const name = body.name?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: "Workspace name must be 1–80 characters." }, { status: 400 });
  if (body.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) {
    return NextResponse.json({ error: "Workspace ID must be a UUID." }, { status: 400 });
  }
  const kind = body.kind === "business" ? "business" : "personal";
  const { data, error } = await auth.supabase.from("workspaces").insert({
    ...(body.id ? { id: body.id } : {}),
    owner_id: auth.user.id,
    name,
    kind,
    is_default: false,
  }).select("id, owner_id, name, kind, created_at, is_default, archived_at").single();
  if (error || !data) return NextResponse.json({ error: "Workspace could not be created." }, { status: 400 });
  const { error: memberError } = await auth.supabase.from("workspace_members").upsert({
    workspace_id: data.id,
    user_id: auth.user.id,
    role: "owner",
  }, { onConflict: "workspace_id,user_id" });
  if (memberError) {
    await auth.supabase.from("workspaces").delete().eq("id", data.id).eq("owner_id", auth.user.id);
    return NextResponse.json({ error: "Workspace membership could not be initialized." }, { status: 500 });
  }
  return NextResponse.json({ workspace: {
    id: data.id, ownerUserId: data.owner_id, name: data.name, kind: data.kind,
    createdAt: data.created_at, isDefault: data.is_default, archivedAt: data.archived_at,
  } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorizedClient();
  if ("error" in auth) return auth.error;
  let body: { id?: string; name?: string; archive?: boolean };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
  const update: { name?: string; archived_at?: string | null } = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 80) return NextResponse.json({ error: "Workspace name must be 1–80 characters." }, { status: 400 });
    update.name = name;
  }
  if (body.archive !== undefined) {
    const { data: current } = await auth.supabase.from("workspaces").select("is_default").eq("id", body.id).eq("owner_id", auth.user.id).maybeSingle();
    if (!current) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    if (current.is_default && body.archive) return NextResponse.json({ error: "The default workspace cannot be archived." }, { status: 409 });
    update.archived_at = body.archive ? new Date().toISOString() : null;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "No workspace changes were provided." }, { status: 400 });
  const { data, error } = await auth.supabase.from("workspaces").update(update)
    .eq("id", body.id).eq("owner_id", auth.user.id)
    .select("id, owner_id, name, kind, created_at, is_default, archived_at").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Workspace could not be updated." }, { status: 400 });
  return NextResponse.json({ workspace: {
    id: data.id, ownerUserId: data.owner_id, name: data.name, kind: data.kind,
    createdAt: data.created_at, isDefault: data.is_default, archivedAt: data.archived_at,
  } });
}

export async function DELETE(request: Request) {
  const auth = await authorizedClient();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
  const { data: workspace } = await auth.supabase.from("workspaces").select("is_default").eq("id", id).eq("owner_id", auth.user.id).maybeSingle();
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  if (workspace.is_default) return NextResponse.json({ error: "The default workspace cannot be deleted." }, { status: 409 });
  const { count, error: countError } = await auth.supabase.from("sync_records").select("record_id", { count: "exact", head: true }).eq("workspace_id", id);
  if (countError) return NextResponse.json({ error: "Could not verify whether the workspace is empty." }, { status: 503 });
  if ((count ?? 0) > 0) return NextResponse.json({ error: "This workspace contains records. Archive it to preserve its data." }, { status: 409 });
  const { error } = await auth.supabase.from("workspaces").delete().eq("id", id).eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: "Workspace could not be deleted." }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
