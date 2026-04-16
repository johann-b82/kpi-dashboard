import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "../components/docs/MarkdownRenderer";
import { TableOfContents } from "../components/docs/TableOfContents";
import { extractToc } from "../lib/docs/toc";

// Build-time ?raw imports — stub content for smoke testing
import enGettingStarted from "../docs/en/getting-started.md?raw";
import deGettingStarted from "../docs/de/getting-started.md?raw";

const contentMap: Record<string, Record<string, string>> = {
  en: { "getting-started": enGettingStarted },
  de: { "getting-started": deGettingStarted },
};

export default function DocsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("de") ? "de" : "en";
  const content = contentMap[lang]?.["getting-started"] ?? contentMap.en["getting-started"];
  const tocEntries = useMemo(() => extractToc(content), [content]);

  return (
    <div className="flex gap-8 px-6 py-8">
      <article className="flex-1 min-w-0">
        <MarkdownRenderer content={content} />
      </article>
      <aside className="sticky top-24 hidden lg:block w-60 shrink-0">
        <TableOfContents entries={tocEntries} />
      </aside>
    </div>
  );
}
