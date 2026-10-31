import { describe, expect, it } from "vitest";
import type { DataMap } from "@/lib/tools/shared";
import { filterContentTabs, resolveContentScope, scopeContentData } from "@/lib/workspaces/content-scope";
import type { LedgerTab } from "@/components/tools/ledger-tool";

const data = {
  brands: [
    { id: "brand", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "GridHub" },
  ],
  plans: [
    { id: "plan-a", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "Launch", brandId: "brand" },
    { id: "plan-b", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "Personal", archived: true },
    { id: "deleted-plan", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "Deleted", deleted: true },
  ],
  channels: [
    { id: "x-one", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "GridHub X", platform: "x", brandId: "brand", active: true },
    { id: "x-two", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "Personal X", platform: "x", active: true },
  ],
  posts: [
    { id: "post-a", createdAt: "2026-01-01", updatedAt: "2026-01-01", title: "Shared announcement", planId: "plan-a", platform: "x", contentType: "post", status: "draft" },
    { id: "post-b", createdAt: "2026-01-01", updatedAt: "2026-01-01", title: "Private note", planId: "plan-b", platform: "x", contentType: "post", status: "draft" },
    { id: "legacy", createdAt: "2026-01-01", updatedAt: "2026-01-01", title: "Unassigned legacy", platform: "x", contentType: "post", status: "draft" },
  ],
  publications: [
    { id: "pub-x-one", createdAt: "2026-01-01", updatedAt: "2026-01-01", contentId: "post-a", channelAccountId: "x-one", status: "scheduled" },
    { id: "pub-x-two", createdAt: "2026-01-01", updatedAt: "2026-01-01", contentId: "post-a", channelAccountId: "x-two", status: "published", reach: 100 },
    { id: "pub-b", createdAt: "2026-01-01", updatedAt: "2026-01-01", contentId: "post-b", channelAccountId: "x-two", status: "draft" },
  ],
  campaigns: [
    { id: "campaign", createdAt: "2026-01-01", updatedAt: "2026-01-01", name: "Launch campaign" },
  ],
} as unknown as DataMap;

describe("content plan and channel scope", () => {
  it("defaults to All Content and rejects missing or deleted scope IDs", () => {
    expect(resolveContentScope(data, null)).toBeNull();
    expect(resolveContentScope(data, { kind: "plan", id: "missing" })).toBeNull();
    expect(resolveContentScope(data, { kind: "plan", id: "deleted-plan" })).toBeNull();
    expect(resolveContentScope(data, { kind: "channel", id: "missing" })).toBeNull();
  });

  it("filters plan content and includes its independent publication destinations", () => {
    expect(scopeContentData(data, { kind: "plan", id: "plan-a" })).toMatchObject({
      posts: [{ id: "post-a" }],
      publications: [{ id: "pub-x-one" }, { id: "pub-x-two" }],
      plans: [{ id: "plan-a" }],
      channels: [{ id: "x-one" }, { id: "x-two" }],
      brands: [{ id: "brand" }],
    });
  });

  it("shows the shared source item once when filtering by either of two same-platform accounts", () => {
    const xAccount = scopeContentData(data, { kind: "channel", id: "x-one" });
    expect(xAccount.posts.map((post) => post.id)).toEqual(["post-a"]);
    expect(xAccount.publications.map((publication) => publication.id)).toEqual(["pub-x-one"]);

    const personalAccount = scopeContentData(data, { kind: "channel", id: "x-two" });
    expect(personalAccount.posts.map((post) => post.id)).toEqual(["post-a", "post-b"]);
    expect(personalAccount.publications.map((publication) => publication.id)).toEqual(["pub-x-two", "pub-b"]);
  });

  it("filters content tables consistently but leaves All Content and legacy records intact", () => {
    const tabs = [
      { id: "posts", label: "Content", collection: "posts", fields: [] },
      { id: "publications", label: "Publications", collection: "publications", fields: [] },
    ] as unknown as LedgerTab[];
    const [postsTab, publicationsTab] = filterContentTabs(tabs, data, { kind: "channel", id: "x-one" });
    expect(postsTab.filter?.(data.posts![0])).toBe(true);
    expect(postsTab.filter?.(data.posts![1])).toBe(false);
    expect(postsTab.filter?.(data.posts![2])).toBe(false);
    expect(publicationsTab.filter?.(data.publications![0])).toBe(true);
    expect(publicationsTab.filter?.(data.publications![1])).toBe(false);
    expect(scopeContentData(data, null)).toBe(data);
  });

  it("limits publication form choices to the active plan or account", () => {
    const publicationTab = {
      id: "publications",
      label: "Publications",
      collection: "publications",
      fields: [
        { key: "contentId", label: "Content", type: "select" },
        { key: "channelAccountId", label: "Channel", type: "select" },
      ],
    } as unknown as LedgerTab;

    const [planTab] = filterContentTabs([publicationTab], data, { kind: "plan", id: "plan-a" });
    expect(planTab.fields[0].options?.map((option) => option.value)).toEqual(["post-a"]);
    expect(planTab.fields[1].options?.map((option) => option.value)).toEqual(["x-one", "x-two"]);

    const [channelTab] = filterContentTabs([publicationTab], data, { kind: "channel", id: "x-one" });
    expect(channelTab.fields[0].options?.map((option) => option.value)).toEqual(["post-a", "post-b", "legacy"]);
    expect(channelTab.fields[1].options?.map((option) => option.value)).toEqual(["x-one"]);
  });
});
