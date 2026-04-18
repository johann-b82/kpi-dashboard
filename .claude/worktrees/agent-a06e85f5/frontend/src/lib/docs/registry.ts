import enUserIntro from "../../docs/en/user-guide/intro.md?raw";
import deUserIntro from "../../docs/de/user-guide/intro.md?raw";
import enAdminIntro from "../../docs/en/admin-guide/intro.md?raw";
import deAdminIntro from "../../docs/de/admin-guide/intro.md?raw";

export type ArticleEntry = { slug: string; titleKey: string };
export type SectionId = "user-guide" | "admin-guide";

/** Sidebar structure — ordered lists of articles per section */
export const sections: Record<SectionId, ArticleEntry[]> = {
  "user-guide": [{ slug: "intro", titleKey: "docs.nav.userGuideIntro" }],
  "admin-guide": [{ slug: "intro", titleKey: "docs.nav.adminGuideIntro" }],
};

/** Content registry: registry[lang][section][slug] = raw Markdown string */
export const registry: Record<string, Record<string, Record<string, string>>> = {
  en: {
    "user-guide": { intro: enUserIntro },
    "admin-guide": { intro: enAdminIntro },
  },
  de: {
    "user-guide": { intro: deUserIntro },
    "admin-guide": { intro: deAdminIntro },
  },
};
