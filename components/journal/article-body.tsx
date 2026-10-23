import Link from "next/link";
import * as React from "react";

function inline(text: string): React.ReactNode[] {
  const chunks = text.split(/(!\[[^\]]*\]\((?:https?:\/\/[^\s)]+|\/[^\s)]*)\)|\[[^\]]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return chunks.map((chunk, index) => {
    const image = chunk.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)$/);
    if (image) return <img key={index} src={image[2]} alt={image[1]} loading="lazy" className="my-5 max-h-[520px] w-full rounded-2xl border border-line object-contain" />;
    const link = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return link[2].startsWith("/") && !link[2].startsWith("//") ? <Link key={index} className="underline decoration-[var(--accent)] underline-offset-4" href={link[2]}>{link[1]}</Link> : <a key={index} className="underline decoration-[var(--accent)] underline-offset-4" href={link[2]} rel="noopener noreferrer" target="_blank">{link[1]}</a>;
    if (chunk.startsWith("**") && chunk.endsWith("**")) return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith("`") && chunk.endsWith("`")) return <code key={index} className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[0.9em]">{chunk.slice(1, -1)}</code>;
    return chunk;
  });
}

/** Renders a small safe Markdown subset without injecting untrusted HTML. */
export function ArticleBody({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = []; let ordered = false;
  const flush = () => { if (list.length) { const Tag = ordered ? "ol" : "ul"; blocks.push(<Tag key={`list-${blocks.length}`} className={`my-5 space-y-2 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{list.map((line, i) => <li key={i}>{inline(line)}</li>)}</Tag>); list = []; ordered = false; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) { flush(); continue; }
    const heading = raw.match(/^(#{2,4})\s+(.+)$/);
    if (heading) { flush(); const level = heading[1].length; const text = heading[2]; const id = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); const Tag = `h${level}` as "h2" | "h3" | "h4"; blocks.push(<Tag id={id} key={`h-${i}`} className="scroll-mt-24 pt-6 font-semibold tracking-tight">{inline(text)}</Tag>); continue; }
    if (/^\|.+\|$/.test(raw) && /^\|?\s*:?-{3,}/.test(lines[i + 1]?.trim() ?? "")) {
      flush();
      const cells = (value: string) => value.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = cells(raw); i += 2; const tableRows: string[][] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) { tableRows.push(cells(lines[i].trim())); i++; }
      i--;
      blocks.push(<div key={`table-${i}`} className="my-6 overflow-x-auto rounded-xl border border-line"><table className="min-w-full border-collapse text-left text-sm"><thead className="bg-[var(--bg-subtle)]"><tr>{headers.map((cell, j) => <th key={j} className="px-3 py-2 font-semibold">{inline(cell)}</th>)}</tr></thead><tbody>{tableRows.map((row, r) => <tr key={r} className="border-t border-line">{headers.map((_, c) => <td key={c} className="px-3 py-2 text-fg-muted">{inline(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^[-*]\s+/.test(raw)) { if (list.length && ordered) flush(); list.push(raw.replace(/^[-*]\s+/, "")); continue; }
    if (/^\d+[.)]\s+/.test(raw)) { if (list.length && !ordered) flush(); ordered = true; list.push(raw.replace(/^\d+[.)]\s+/, "")); continue; }
    const quote = raw.match(/^>\s?(.*)$/);
    if (quote) { flush(); blocks.push(<blockquote key={`q-${i}`} className="my-5 border-l-2 border-[var(--accent)] pl-4 text-fg-muted">{inline(quote[1])}</blockquote>); continue; }
    flush(); blocks.push(<p key={`p-${i}`} className="my-4 leading-8 text-fg-muted">{inline(raw)}</p>);
  }
  flush();
  return <div className="journal-prose text-[16px] sm:text-[17px]">{blocks}</div>;
}
