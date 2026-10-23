import { NextResponse } from "next/server";
import { journalAdmin } from "@/lib/journal/auth";
import { getServiceClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET() { const auth = await journalAdmin(); if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status }); const service = getServiceClient(); if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 }); const { data, error } = await service.from("journal_job_runs").select("*").order("created_at", { ascending: false }).limit(100); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ jobs: data ?? [] }); }
