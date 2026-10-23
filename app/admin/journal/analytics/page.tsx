import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
function ninetyDaysAgo() { return new Date(Date.now() - 90 * 86400000).toISOString(); }
export default async function JournalAnalyticsPage() {
  const service = getServiceClient();
  const since = ninetyDaysAgo();
  const [{ data: performance, error }, { data: events, error: eventError }] = service ? await Promise.all([
    service.from("journal_content_performance").select("observed_on,impressions,organic_clicks,ctr,average_position,article_views,cta_clicks,signups,source,journal_articles(title,slug)").order("observed_on", { ascending: false }).limit(200),
    service.from("journal_events").select("event_name,article_id,created_at,journal_articles(title)").gte("created_at", since).limit(10000),
  ]) : [{ data: null, error: { message: "Service role key not configured" } }, { data: null, error: { message: "Service role key not configured" } }];
  const eventTotals = new Map<string, number>();
  const articleEventTotals = new Map<string, { title: string; eventName: string; count: number }>();
  for (const event of events ?? []) {
    eventTotals.set(event.event_name, (eventTotals.get(event.event_name) ?? 0) + 1);
    const article = event.journal_articles as unknown as { title: string } | null;
    const key = `${event.article_id}:${event.event_name}`;
    const aggregate = articleEventTotals.get(key) ?? { title: article?.title ?? "Article", eventName: event.event_name, count: 0 };
    aggregate.count++;
    articleEventTotals.set(key, aggregate);
  }
  return <><SectionHeading eyebrow="Observed data" title="Journal analytics" description="Opt-in article events are anonymous and deduplicated per article, event, and browser session. Search performance appears only when imported or connected."/><JournalAdminNav/>{!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID && <InlineAlert tone="info" title="Search Console is not connected">Configure authorized Google Search Console credentials before expecting organic impressions, clicks, CTR, or average position.</InlineAlert>}{error && <InlineAlert tone="warning" title="Performance snapshots unavailable">{error.message}</InlineAlert>}{eventError && <InlineAlert tone="warning" title="Article event counts unavailable">{eventError.message}. Apply the Journal database migration.</InlineAlert>}<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Article views", eventTotals.get("journal_article_viewed") ?? 0], ["GridHub CTA clicks", eventTotals.get("journal_cta_clicked") ?? 0], ["Calculator opens", eventTotals.get("journal_calculator_opened") ?? 0], ["Search snapshots", performance?.length ?? 0]].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs text-fg-subtle">{label}</p><p className="mt-2 text-2xl font-semibold">{eventError && String(label) !== "Search snapshots" ? "—" : Number(value).toLocaleString()}</p></Card>)}</div><Card className="divide-y divide-line p-4"><h2 className="pb-3 text-sm font-semibold">Opt-in events by article · last 90 days</h2>{[...articleEventTotals.values()].map((event) => <div key={`${event.eventName}-${event.title}`} className="flex flex-wrap justify-between gap-3 py-2 text-xs"><span className="font-medium">{event.title}</span><span className="text-fg-subtle">{event.eventName.replaceAll("journal_", "").replaceAll("_", " ")} · {event.count.toLocaleString()}</span></div>)}{!eventError && !events?.length && <p className="py-8 text-center text-sm text-fg-muted">No opted-in article visits or CTA clicks have been recorded yet.</p>}</Card><Card className="divide-y divide-line p-4"><h2 className="pb-3 text-sm font-semibold">Search performance snapshots</h2>{(performance ?? []).map((row, index) => { const article = row.journal_articles as unknown as { title: string } | null; return <div key={`${row.observed_on}-${index}`} className="flex flex-wrap justify-between gap-3 py-2 text-xs"><span className="font-medium">{article?.title ?? "Article"} · {row.source}</span><span className="text-fg-subtle">{row.observed_on} · {row.organic_clicks ?? "—"} clicks / {row.impressions ?? "—"} impressions</span></div>; })}{!error && !performance?.length && <p className="py-8 text-center text-sm text-fg-muted">No Search Console or performance snapshots are available yet. Signups and paid conversions are not currently attributed.</p>}</Card></>;
}
