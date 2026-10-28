"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, InlineAlert, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { platformLabel, type SocialPlatform } from "@/lib/journal/social";

type Article = { id: string; slug: string; title: string; excerpt: string; status: string; approved_revision_id: string | null; published_revision_id: string | null; published_at: string | null; current_revision_id: string | null; related_calculator_slug: string | null; journal_categories?: { name: string } | null };
type SocialPost = { id: string; source_article_id: string; source_article_revision_id: string; platform: SocialPlatform; format: string; status: string; current_revision_id: string | null; approved_revision_id: string | null; scheduled_at: string | null; published_at: string | null; publication_mode: string | null };
type Revision = { id: string; social_post_id: string; revision_number: number; title: string; body: string; cta_url: string; creative_brief: Record<string, unknown>; created_at: string };
type Approval = { social_post_id: string; decision: string; notes: string; created_at: string };
type Payload = { articles: Article[]; posts: SocialPost[]; revisions: Revision[]; approvals: Approval[]; integrations: { generation: string; publishing: string; analytics: string } };
const channels: { id: SocialPlatform; name: string }[] = [{ id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" }, { id: "instagram", name: "Instagram" }, { id: "youtube_shorts", name: "YouTube Shorts" }];
const statusTone = (status: string) => status === "approved" || status === "published_manual" ? "positive" : status === "needs_revision" || status === "failed" ? "warning" : "neutral";
const fieldClass = "w-full rounded-xl border border-line bg-[var(--surface)] px-3 py-2.5 text-sm text-fg outline-none focus:border-[var(--accent)]";

export function JournalSocialWorkspace() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [articleId, setArticleId] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(channels.map((channel) => channel.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [edits, setEdits] = useState<Record<string, { title: string; body: string }>>({});
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/journal/social", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not load Social Distribution."); return; }
    setPayload(data);
    setEdits(Object.fromEntries(data.posts.map((post: SocialPost) => {
      const revision = data.revisions.find((item: Revision) => item.id === post.current_revision_id) as Revision | undefined;
      return [post.id, { title: revision?.title ?? "", body: revision?.body ?? "" }];
    })));
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const counts = useMemo(() => {
    const posts = payload?.posts ?? [];
    return { drafts: posts.filter((p) => p.status === "draft" || p.status === "needs_revision").length, review: posts.filter((p) => p.status === "needs_review").length, approved: posts.filter((p) => p.status === "approved").length, scheduled: posts.filter((p) => p.status === "scheduled").length };
  }, [payload]);
  const latestByPost = useMemo(() => {
    const map = new Map<string, Revision[]>();
    for (const revision of payload?.revisions ?? []) map.set(revision.social_post_id, [...(map.get(revision.social_post_id) ?? []), revision]);
    return map;
  }, [payload]);
  const articlesById = useMemo(() => new Map((payload?.articles ?? []).map((article) => [article.id, article])), [payload]);

  async function generate() {
    if (!articleId || !selectedPlatforms.length) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/journal/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ article_id: articleId, platforms: selectedPlatforms }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error ?? "Could not create drafts."); if (data.created?.length) await load(); return; }
    setMessage(`${data.created.length} platform draft${data.created.length === 1 ? "" : "s"} created from the approved article revision.`);
    await load();
  }

  async function action(post: SocialPost, actionName: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/admin/journal/social/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, ...extra }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error ?? "Could not update this social draft."); return; }
    setMessage(data.note ?? (data.unchanged ? "No changes to save." : "Social draft updated."));
    await load();
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage("Copied post content."); }
    catch { setError("Clipboard access is unavailable. Select and copy the text manually."); }
  }

  const articles = payload?.articles ?? [];
  const sortedPosts = [...(payload?.posts ?? [])].sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"));
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Drafts" value={counts.drafts} hint="Need editing or review" />
      <MetricCard label="Awaiting review" value={counts.review} hint="Independent social approval" />
      <MetricCard label="Approved" value={counts.approved} hint="Ready for manual publishing" />
      <MetricCard label="Scheduled" value={counts.scheduled} hint="Manual publishing reminders" />
    </div>
    <InlineAlert tone="info" title="Publishing connections are not configured">Draft creation uses source-linked templates. No AI provider, social publishing account, automatic scheduler, or platform analytics connection is configured, so posts stay editable and are never sent automatically. YouTube Shorts drafts are scripts and shot lists, not video files.</InlineAlert>
    <Card className="space-y-4 p-4 sm:p-5">
      <div><h2 className="text-base font-semibold">Create platform drafts</h2><p className="mt-1 text-xs leading-relaxed text-fg-muted">Drafts use the article&apos;s approved revision (or published revision) and must pass a separate human review for every channel.</p></div>
      <label className="block space-y-1.5 text-xs font-medium text-fg-muted">Approved or published Journal article
        <select className={fieldClass} value={articleId} onChange={(event) => setArticleId(event.target.value)}><option value="">Choose an article…</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.title} · {article.status}</option>)}</select>
      </label>
      <div className="flex flex-wrap gap-2">{channels.map((channel) => <label key={channel.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-2 text-xs"><input type="checkbox" checked={selectedPlatforms.includes(channel.id)} onChange={(event) => setSelectedPlatforms((old) => event.target.checked ? [...old, channel.id] : old.filter((id) => id !== channel.id))} />{channel.name}</label>)}</div>
      <div><Button variant="primary" disabled={busy || !articleId || !selectedPlatforms.length} onClick={() => void generate()}>{busy ? "Creating drafts…" : "Create Social Drafts"}</Button></div>
    </Card>
    {message && <p role="status" className="text-xs text-[var(--positive)]">{message}</p>}
    {error && <InlineAlert tone="warning" title="Social Distribution needs attention">{error}</InlineAlert>}
    <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Editorial queue</p><h2 className="mt-1 text-lg font-semibold">Social drafts</h2></div><Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button></div>
    {sortedPosts.map((post) => {
      const article = articlesById.get(post.source_article_id);
      const revision = (latestByPost.get(post.id) ?? []).find((item) => item.id === post.current_revision_id);
      const edit = edits[post.id] ?? { title: revision?.title ?? "", body: revision?.body ?? "" };
      const isEditable = ["draft", "needs_revision", "approved", "needs_review"].includes(post.status);
      const charCount = edit.body.length;
      const sourceIsOutdated = Boolean(article?.current_revision_id && article.current_revision_id !== post.source_article_revision_id);
      return <Card key={post.id} className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{platformLabel(post.platform)} · {post.format}</h3><Badge tone={statusTone(post.status)}>{post.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-fg-muted">Source: {article ? <a className="underline underline-offset-2" href={`/journal/${article.slug}`} target="_blank" rel="noreferrer">{article.title}</a> : "Journal article"} · source revision {post.source_article_revision_id.slice(0, 8)}</p><p className="mt-1 text-[11px] text-fg-subtle">Social revision {revision?.revision_number ?? "—"}{post.approved_revision_id && post.approved_revision_id === post.current_revision_id ? " · current revision approved" : ""}</p></div><Button size="sm" variant="secondary" onClick={() => void copy(`${edit.title}\n\n${edit.body}`)}>Copy text</Button></div>
        {sourceIsOutdated && <InlineAlert tone="warning" title="Check this draft against the latest article revision">This social copy was created from an earlier approved article version. Review its claims and links before requesting approval.</InlineAlert>}
        <label className="block space-y-1.5 text-xs font-medium text-fg-muted">Post title<input className={fieldClass} value={edit.title} disabled={!isEditable} onChange={(event) => setEdits((old) => ({ ...old, [post.id]: { ...edit, title: event.target.value } }))} /></label>
        <label className="block space-y-1.5 text-xs font-medium text-fg-muted">Post content<textarea className={`${fieldClass} min-h-52 resize-y leading-relaxed`} value={edit.body} disabled={!isEditable} onChange={(event) => setEdits((old) => ({ ...old, [post.id]: { ...edit, body: event.target.value } }))} /><span className="block text-right text-[10px] text-fg-subtle">{charCount} characters · platform counters are informational; live platform limits can vary</span></label>
        {revision?.creative_brief && Object.keys(revision.creative_brief).length > 0 && <details className="rounded-xl border border-line px-3 py-2"><summary className="cursor-pointer text-xs font-medium">Creative brief · no media generated</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-fg-muted">{JSON.stringify(revision.creative_brief, null, 2)}</pre></details>}
        {(latestByPost.get(post.id)?.length ?? 0) > 1 && <details className="rounded-xl border border-line px-3 py-2"><summary className="cursor-pointer text-xs font-medium">Revision history ({latestByPost.get(post.id)?.length})</summary><div className="mt-2 space-y-2">{latestByPost.get(post.id)?.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-[11px]"><span>Revision {item.revision_number} · {new Date(item.created_at).toLocaleString()} · {item.title}</span>{isEditable && <Button size="sm" variant="ghost" onClick={() => setEdits((old) => ({ ...old, [post.id]: { title: item.title, body: item.body } }))}>Load into editor</Button>}</div>)}</div></details>}
        {post.status === "scheduled" && post.scheduled_at && <p className="text-xs text-fg-muted">Manual publishing reminder: {new Date(post.scheduled_at).toLocaleString()}</p>}
        {post.status === "published_manual" && <p className="text-xs text-[var(--positive)]">Marked published manually by an administrator{post.published_at ? ` · ${new Date(post.published_at).toLocaleString()}` : ""}. No platform API confirmation is available.</p>}
        {payload?.approvals.filter((item) => item.social_post_id === post.id).slice(0, 2).map((approval, index) => <p key={`${approval.created_at}-${index}`} className="text-[11px] text-fg-subtle">Review: {approval.decision.replaceAll("_", " ")}{approval.notes ? ` · ${approval.notes}` : ""}</p>)}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {isEditable && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(post, "save", { title: edit.title, body: edit.body, cta_url: revision?.cta_url ?? "", creative_brief: revision?.creative_brief ?? {} })}>Save revision</Button>}
          {(["draft", "needs_revision"].includes(post.status)) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(post, "request-review")}>Request review</Button>}
          {post.status === "needs_review" && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(post, "request-changes", { notes: "Please revise this social draft." })}>Request changes</Button><Button size="sm" variant="primary" disabled={busy} onClick={() => void action(post, "approve")}>Approve this revision</Button></>}
          {post.status === "approved" && <><label className="text-xs text-fg-muted">Manual publish reminder<input id={`schedule-${post.id}`} aria-label="Manual publishing reminder time" type="datetime-local" className="ml-2 h-8 rounded-lg border border-line bg-[var(--surface)] px-2 text-xs" /></label><Button size="sm" variant="secondary" disabled={busy} onClick={() => { const value = (document.getElementById(`schedule-${post.id}`) as HTMLInputElement | null)?.value; void action(post, "schedule", { scheduled_at: value ? new Date(value).toISOString() : "" }); }}>Schedule reminder</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(post, "mark-published-manually")}>Mark published manually</Button></>}
          {post.status === "scheduled" && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(post, "cancel-schedule")}>Cancel reminder</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(post, "mark-published-manually")}>Mark published manually</Button></>}
          <div className="ml-auto flex gap-2 text-[11px] text-fg-subtle">{platformLink(post.platform) && <a className="underline underline-offset-2" href={platformLink(post.platform)!} target="_blank" rel="noreferrer">Open {platformLabel(post.platform)}</a>}</div>
        </div>
      </Card>;
    })}
    {!sortedPosts.length && <Card className="p-8 text-center text-sm text-fg-muted">No social drafts yet. Choose an approved or published article above to create channel-specific drafts.</Card>}
    {articles.length === 0 && payload && <p className="text-xs text-fg-subtle">No approved or published articles are available for distribution yet.</p>}
  </div>;
}

function platformLink(platform: SocialPlatform) {
  if (platform === "x") return "https://x.com/compose/post";
  if (platform === "linkedin") return "https://www.linkedin.com/feed/";
  if (platform === "instagram") return "https://www.instagram.com/";
  return "https://studio.youtube.com/";
}
