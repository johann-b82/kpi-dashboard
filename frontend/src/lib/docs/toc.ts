import GithubSlugger from "github-slugger";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { Heading, PhrasingContent } from "mdast";

export interface TocEntry {
  level: 2 | 3;
  text: string;
  id: string;
}

function extractText(children: PhrasingContent[]): string {
  return children
    .map((c) => ("value" in c ? c.value : "children" in c ? extractText((c as { children: PhrasingContent[] }).children) : ""))
    .join("");
}

export function extractToc(markdown: string): TocEntry[] {
  const tree = remark().use(remarkGfm).parse(markdown);
  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  for (const node of tree.children) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const text = extractText((node as Heading).children);
      entries.push({ level: node.depth as 2 | 3, text, id: slugger.slug(text) });
    }
  }
  return entries;
}
