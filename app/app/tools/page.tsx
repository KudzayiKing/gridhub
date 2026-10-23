import { ToolCatalog } from "@/components/tools/tool-catalog";

export const metadata = { title: "My tools" };

export default function MyToolsPage() {
  return <ToolCatalog mode="mine" />;
}
