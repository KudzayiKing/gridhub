import { notFound } from "next/navigation";
import { ToolView } from "@/components/tools/tool-view";
import { TOOLS } from "@/lib/catalog";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.route.replace(/^\/app\//, "").split("/") }));
}

export default async function ToolRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/app/${(slug ?? []).join("/")}`;
  const tool = TOOLS.find((t) => t.route === path);

  if (!tool) notFound();

  return <ToolView key={tool.id} toolId={tool.id} />;
}
