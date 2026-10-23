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
    // A manifest carries a single value each, so these cannot follow the in-app theme.
    // background stays the light canvas (splash for a light install) while theme_color is the
    // dark surface, which is what the status bar shows once the app is open.
    background_color: "#F7F7F2",
    theme_color: "#121214",
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
