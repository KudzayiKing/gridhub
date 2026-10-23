import { ToolCatalog } from "@/components/tools/tool-catalog";

export const metadata = { title: "Explore tools" };

export default function ExplorePage() {
  return <ToolCatalog mode="explore" />;
}
