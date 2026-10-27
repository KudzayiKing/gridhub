import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gridhub — One hub. Everything organized",
    short_name: "Gridhub",
    description:
      "Your money. Your business. Your life. Your work. One intelligent workspace.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    // The splash uses the canvas; the status bar uses the header's glass over that canvas, so
    // the platform bar and the sticky header meet without a step. Must stay in step with
    // `viewport.themeColor` in app/layout.tsx — the install-time value is read from here, and
    // an installed app keeps it until the manifest is re-read.
    background_color: "#F7F7F2",
    theme_color: "#FCFCFA",
    categories: ["productivity", "finance", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/app", description: "Your personalized workspace" },
      { name: "Budget", url: "/app/money/budget", description: "Annual budget planner" },
      { name: "Projects", url: "/app/work/projects", description: "Project dashboard" },
      { name: "Nutrition", url: "/app/life/nutrition", description: "Food diary" },
    ],
  };
}
