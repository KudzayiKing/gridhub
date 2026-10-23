import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { journalAdmin } from "@/lib/journal/auth";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const auth = await journalAdmin(); if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient(); if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params; const { data, error } = await service.from("journal_research_sources").select("*").eq("article_id", id).order("accessed_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ sources: data ?? [] });
}
export async function POST(request: Request, { params }: Context) {
  const auth = await journalAdmin(); if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient(); if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params; let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const url = String(body.url ?? "");
  try { const parsed = new URL(url); if (!["https:", "http:"].includes(parsed.protocol)) throw new Error(); } catch { return NextResponse.json({ error: "Enter a valid http or https source URL." }, { status: 400 }); }
  if (!String(body.title ?? "").trim()) return NextResponse.json({ error: "Source title is required." }, { status: 400 });
  const { data, error } = await service.from("journal_research_sources").insert({ article_id: id, title: String(body.title).trim(), url, publisher: String(body.publisher ?? ""), published_at: body.published_at || null, notes: String(body.notes ?? ""), verified: body.verified === true, source_type: "editorial" }).select("id").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ id: data?.id }, { status: 201 });
}
