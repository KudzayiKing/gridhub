import type { LedgerTab } from "../../components/tools/ledger-tool";
import type { BaseRecord, ChannelAccount, ContentCampaign, ContentPlan, ContentPost, ContentPublication } from "../types";
import type { DataMap } from "../tools/shared";

export type ContentScope = { kind: "plan" | "channel"; id: string } | null;

export function resolveContentScope(data: DataMap, selection: ContentScope): ContentScope {
  if (!selection) return null;
  const collection = selection.kind === "plan" ? "plans" : "channels";
  const records = data[collection] ?? [];
  return records.some((record) => !record.deleted && record.id === selection.id) ? selection : null;
}

export function scopeContentData(data: DataMap, scope: ContentScope): DataMap {
  if (!scope) return data;

  const posts = (data.posts ?? []) as ContentPost[];
  const publications = (data.publications ?? []) as ContentPublication[];
  const plans = (data.plans ?? []) as ContentPlan[];
  const channels = (data.channels ?? []) as ChannelAccount[];
  const campaigns = (data.campaigns ?? []) as ContentCampaign[];

  if (scope.kind === "plan") {
    const plan = plans.find((item) => item.id === scope.id);
    const scopedPosts = posts.filter((post) => post.planId === scope.id);
    const postIds = new Set(scopedPosts.map((post) => post.id));
    const scopedPublications = publications.filter((publication) => postIds.has(publication.contentId));
    const channelIds = new Set(scopedPublications.map((publication) => publication.channelAccountId));
    const campaignIds = new Set(scopedPosts.map((post) => post.campaign).filter((id): id is string => Boolean(id)));
    return {
      ...data,
      posts: scopedPosts,
      publications: scopedPublications,
      plans: plans.filter((item) => item.id === scope.id),
      channels: channels.filter((item) => channelIds.has(item.id) || Boolean(plan?.brandId && item.brandId === plan.brandId)),
      brands: plan?.brandId ? (data.brands ?? []).filter((brand) => brand.id === plan.brandId) : [],
      campaigns: campaigns.filter((campaign) => campaignIds.has(campaign.id)),
    };
  }

  const scopedPublications = publications.filter((publication) => publication.channelAccountId === scope.id);
  const postIds = new Set(scopedPublications.map((publication) => publication.contentId));
  const scopedPosts = posts.filter((post) => postIds.has(post.id));
  const planIds = new Set(scopedPosts.map((post) => post.planId).filter((id): id is string => Boolean(id)));
  const campaignIds = new Set(scopedPosts.map((post) => post.campaign).filter((id): id is string => Boolean(id)));
  const channel = channels.find((item) => item.id === scope.id);
  return {
    ...data,
    posts: scopedPosts,
    publications: scopedPublications,
    plans: plans.filter((item) => planIds.has(item.id)),
    channels: channel ? [channel] : [],
    brands: channel?.brandId ? (data.brands ?? []).filter((brand) => brand.id === channel.brandId) : [],
    campaigns: campaigns.filter((campaign) => campaignIds.has(campaign.id)),
  };
}

export function filterContentTabs(tabs: LedgerTab[], data: DataMap, scope: ContentScope): LedgerTab[] {
  if (!scope) return tabs;
  const scoped = scopeContentData(data, scope);
  const visibleIds = new Map<string, Set<string>>();
  for (const collection of ["posts", "publications", "plans", "channels", "brands", "campaigns"]) {
    visibleIds.set(collection, new Set((scoped[collection] ?? []).map((record) => record.id)));
  }
  return tabs.map((tab) => {
    const ids = visibleIds.get(tab.collection);
    const filteredTab = ids ? { ...tab, filter: (row: BaseRecord) => (!tab.filter || tab.filter(row)) && ids.has(row.id) } : tab;
    if (tab.collection !== "publications") return filteredTab;

    const scopedPosts = scope.kind === "plan"
      ? ((data.posts ?? []) as ContentPost[]).filter((post) => post.planId === scope.id)
      : (data.posts ?? []) as ContentPost[];
    const scopedChannels = scope.kind === "plan"
      ? ((scoped.channels ?? []) as ChannelAccount[])
      : ((data.channels ?? []) as ChannelAccount[]).filter((channel) => channel.id === scope.id);
    return {
      ...filteredTab,
      fields: tab.fields.map((field) => {
        if (field.key === "contentId") return { ...field, options: scopedPosts.map((post) => ({ value: post.id, label: post.title, raw: true })) };
        if (field.key === "channelAccountId") return { ...field, options: scopedChannels.map((channel) => ({ value: channel.id, label: channel.name, raw: true })) };
        return field;
      }),
    };
  });
}
