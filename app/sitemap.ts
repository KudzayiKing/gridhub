import type { MetadataRoute } from "next";
import { COLLECTIONS, TOOLS } from "@/lib/catalog";
import { FREE_TOOLS } from "@/lib/free-tool-catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://gridhub.online";
  const now = new Date();

  const staticRoutes = [
    "",
    "/tools",
    "/free-tools",
    "/collections",
    "/gridhub-ai",
    "/pricing",
    "/how-it-works",
    "/offline",
    "/about",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
    "/refund-policy",
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${base}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? ("weekly" as const) : ("monthly" as const),
      priority: route === "" ? 1 : 0.7,
    })),
    ...TOOLS.map((tool) => ({
      url: `${base}/tools/${tool.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...COLLECTIONS.map((collection) => ({
      url: `${base}/collections/${collection.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...FREE_TOOLS.map((tool) => ({
      url: `${base}/free-tools/${tool.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
