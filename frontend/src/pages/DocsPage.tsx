import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "../components/docs/MarkdownRenderer";
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
      {/* TOC sidebar placeholder — implemented in Plan 02 */}
      <aside className="sticky top-24 hidden lg:block w-60 shrink-0">
        <nav aria-label="Table of contents">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {lang === "de" ? "Auf dieser Seite" : "On this page"}
          </p>
          <ol className="space-y-1 text-sm">
            {tocEntries.map((entry) => (
              <li key={entry.id} className={entry.level === 3 ? "pl-4" : ""}>
                <a href={`#${entry.id}`} className="text-muted-foreground hover:text-foreground">
                  {entry.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
    </div>
  );
}
