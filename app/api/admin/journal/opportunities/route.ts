import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { journalAdmin } from "@/lib/journal/auth";
import { normalizeKeyword, scoreOpportunity, type OpportunityInputs } from "@/lib/journal/scoring";
import { DEFAULT_WEIGHTS } from "@/lib/journal/scoring";

export const dynamic = "force-dynamic";
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
const num = (value?: string) => { const normalized = value?.trim().replace(/,/g, ""); return normalized && /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null; };

export async function GET() {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { data, error } = await service.from("journal_keyword_opportunities").select("*,journal_keywords(*)").order("total_score", { ascending: false, nullsFirst: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (data ?? []).map((row) => row.keyword_id);
  const { data: metrics } = ids.length ? await service.from("journal_keyword_metrics").select("*").in("keyword_id", ids).order("created_at", { ascending: false }) : { data: [] };
  const latest = new Map<string, Record<string, unknown>>();
  for (const metric of metrics ?? []) if (!latest.has(metric.keyword_id)) latest.set(metric.keyword_id, metric);
  return NextResponse.json({ opportunities: (data ?? []).map((row) => ({ ...row, keyword: { ...(row.journal_keywords as object), ...(latest.get(row.keyword_id) ?? {}) } })) });
}

export async function POST(request: Request) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv")) return NextResponse.json({ error: "Upload a CSV file as text/csv." }, { status: 415 });
  const csv = await request.text();
  if (csv.length > 2_000_000) return NextResponse.json({ error: "CSV is larger than 2 MB." }, { status: 413 });
  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV needs a header row and at least one keyword." }, { status: 400 });
  const headers = rows[0].map((x) => x.trim().toLowerCase().replace(/\s+/g, "_"));
  const index = (names: string[]) => headers.findIndex((name) => names.includes(name));
  const keywordIndex = index(["keyword", "query", "search_term"]);
  if (keywordIndex < 0) return NextResponse.json({ error: "CSV must include a keyword column." }, { status: 400 });
  const volumeIndex = index(["monthly_search_volume", "avg._monthly_searches", "avg_monthly_searches", "volume"]);
  const countryIndex = index(["country", "location"]), languageIndex = index(["language"]), sourceIndex = index(["source", "provider"]), volumeSourceIndex = index(["volume_source", "provider"]);
  const intentIndex = index(["search_intent", "intent"]), competitionIndex = index(["competition"]), difficultyIndex = index(["difficulty_score", "keyword_difficulty"]), difficultySourceIndex = index(["difficulty_source"]);
  const cpcIndex = index(["cost_per_click", "cpc"]), relatedIndex = index(["related_keywords", "related_queries"]);
  const observedIndex = index(["volume_observed_at", "observed_at", "date"]), titleIndex = index(["proposed_title", "title"]);
  const categoryIndex = index(["category", "category_slug"]), toolIndex = index(["gridhub_tool", "related_tool"]), calculatorIndex = index(["free_calculator", "related_calculator"]), valueIndex = index(["unique_value", "proposed_angle"]);
  const relevanceIndex = index(["relevance_score"]), intentScoreIndex = index(["intent_score"]), differentiationIndex = index(["differentiation_score"]);
  const result = { imported: 0, skipped: 0, errors: [] as string[] };
  const seen = new Set<string>();
  const { data: scoringSetting } = await service.from("journal_settings").select("setting_value").eq("setting_key", "opportunity_weights").maybeSingle();
  const weights = (scoringSetting?.setting_value && typeof scoringSetting.setting_value === "object" ? scoringSetting.setting_value : DEFAULT_WEIGHTS) as Record<keyof OpportunityInputs, number>;
  for (const [offset, cells] of rows.slice(1, 2001).entries()) {
    const cell = (i: number) => i < 0 ? "" : (cells[i] ?? "").trim();
    const keyword = cell(keywordIndex); const normalized = normalizeKeyword(keyword);
    if (!keyword || !normalized) { result.skipped++; continue; }
    if (seen.has(normalized)) { result.skipped++; continue; }
    seen.add(normalized);
    const volumeRaw = cell(volumeIndex);
    if (volumeRaw && num(volumeRaw) === null) { result.errors.push(`Row ${offset + 2}: invalid monthly search volume.`); result.skipped++; continue; }
    const difficultyRaw = cell(difficultyIndex);
    if (difficultyRaw && (num(difficultyRaw) === null || Number(difficultyRaw) > 100)) { result.errors.push(`Row ${offset + 2}: difficulty must be 0–100.`); result.skipped++; continue; }
    const source = cell(sourceIndex) || "manual CSV import";
    const volumeProvider = cell(volumeSourceIndex);
    const category = cell(categoryIndex).toLowerCase();
    if (category && !["money", "business", "life", "work"].includes(category)) { result.errors.push(`Row ${offset + 2}: category must be Money, Business, Life, or Work.`); result.skipped++; continue; }
    const volumeSource = volumeIndex >= 0 && volumeRaw && volumeProvider ? volumeProvider : "unverified";
    const related = cell(relatedIndex).split(/[;|]/).map((s) => s.trim()).filter(Boolean).slice(0, 50);
    const { data: keywordRow, error } = await service.from("journal_keywords").upsert({ keyword, normalized_keyword: normalized, country: cell(countryIndex) || "US", language: cell(languageIndex) || "en", category_slug: category || null, search_intent: cell(intentIndex) || "unknown", related_keywords: related, proposed_title: cell(titleIndex), gridhub_tool: cell(toolIndex) || null, free_calculator: cell(calculatorIndex) || null, unique_value: cell(valueIndex), source, created_by: auth.userId, status: volumeSource === "unverified" ? "needs_validation" : "new" }, { onConflict: "normalized_keyword" }).select("id").single();
    if (error || !keywordRow) { result.errors.push(`Row ${offset + 2}: ${error?.message ?? "could not save keyword"}`); result.skipped++; continue; }
    const observedText = cell(observedIndex);
    const observedAt = observedText && !Number.isNaN(Date.parse(observedText)) ? new Date(observedText).toISOString() : null;
    const volume = volumeRaw ? num(volumeRaw) : null;
    const difficulty = difficultyRaw ? num(difficultyRaw) : null;
    const cpc = num(cell(cpcIndex)); const competition = cell(competitionIndex) || null;
    const recordKey = createHash("sha256").update([normalized, source, observedAt ?? "no-observation-date", volume ?? "", difficulty ?? "", cpc ?? "", competition ?? ""].join("|")).digest("hex");
    const difficultySource = difficultyRaw && cell(difficultySourceIndex) ? cell(difficultySourceIndex) : null;
    const metric = { keyword_id: keywordRow.id, monthly_search_volume: volume, volume_source: volumeSource, volume_observed_at: observedAt, volume_period: observedAt ? observedAt.slice(0, 7) : null, competition, difficulty_score: difficulty, difficulty_source: difficultySource, cost_per_click: cpc, metric_source: source, source_record_key: recordKey };
    const { error: metricError } = await service.from("journal_keyword_metrics").upsert(metric, { onConflict: "source_record_key", ignoreDuplicates: true });
    if (metricError) { result.errors.push(`Row ${offset + 2}: keyword saved but metrics failed: ${metricError.message}`); result.skipped++; continue; }
    const input: OpportunityInputs = {
      relevance: num(cell(relevanceIndex)), intent: num(cell(intentScoreIndex)),
      demand: volume === null || volumeSource === "unverified" ? null : Math.min(100, Math.round(Math.log10(volume + 1) * 25)),
      feasibility: difficulty === null || difficultySource === null ? null : 100 - difficulty,
      differentiation: num(cell(differentiationIndex)),
    };
    const scored = scoreOpportunity(input, weights);
    const { error: opportunityError } = await service.from("journal_keyword_opportunities").upsert({ keyword_id: keywordRow.id, relevance_score: input.relevance, intent_score: input.intent, demand_score: input.demand, feasibility_score: input.feasibility, differentiation_score: input.differentiation, total_score: scored.total, scoring_weights: weights, proposed_angle: "", status: "new" }, { onConflict: "keyword_id" });
    if (opportunityError) result.errors.push(`Row ${offset + 2}: metrics saved but opportunity scoring failed: ${opportunityError.message}`);
    else result.imported++;
  }
  if (rows.length > 2001) result.errors.push("Only the first 2,000 data rows were processed.");
  return NextResponse.json(result);
}
