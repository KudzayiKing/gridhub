import { NextResponse } from "next/server";
import { getJournalCategories } from "@/lib/journal/data";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ categories: await getJournalCategories() }); }
