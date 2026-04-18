import enUserIntro from "../../docs/en/user-guide/intro.md?raw";
import deUserIntro from "../../docs/de/user-guide/intro.md?raw";
import enAdminIntro from "../../docs/en/admin-guide/intro.md?raw";
import deAdminIntro from "../../docs/de/admin-guide/intro.md?raw";
import enUploadingData from "../../docs/en/user-guide/uploading-data.md?raw";
import deUploadingData from "../../docs/de/user-guide/uploading-data.md?raw";
import enSalesDashboard from "../../docs/en/user-guide/sales-dashboard.md?raw";
import deSalesDashboard from "../../docs/de/user-guide/sales-dashboard.md?raw";
import enHrDashboard from "../../docs/en/user-guide/hr-dashboard.md?raw";
import deHrDashboard from "../../docs/de/user-guide/hr-dashboard.md?raw";
import enFilters from "../../docs/en/user-guide/filters.md?raw";
import deFilters from "../../docs/de/user-guide/filters.md?raw";
import enLanguageAndTheme from "../../docs/en/user-guide/language-and-theme.md?raw";
import deLanguageAndTheme from "../../docs/de/user-guide/language-and-theme.md?raw";

export type ArticleEntry = { slug: string; titleKey: string };
export type SectionId = "user-guide" | "admin-guide";

/** Sidebar structure — ordered lists of articles per section */
export const sections: Record<SectionId, ArticleEntry[]> = {
  "user-guide": [
    { slug: "intro", titleKey: "docs.nav.userGuideIntro" },
    { slug: "uploading-data", titleKey: "docs.nav.uploadingData" },
    { slug: "sales-dashboard", titleKey: "docs.nav.salesDashboard" },
    { slug: "hr-dashboard", titleKey: "docs.nav.hrDashboard" },
    { slug: "filters", titleKey: "docs.nav.filters" },
    { slug: "language-and-theme", titleKey: "docs.nav.languageAndTheme" },
  ],
  "admin-guide": [{ slug: "intro", titleKey: "docs.nav.adminGuideIntro" }],
};

/** Content registry: registry[lang][section][slug] = raw Markdown string */
export const registry: Record<string, Record<string, Record<string, string>>> = {
  en: {
    "user-guide": {
      intro: enUserIntro,
      "uploading-data": enUploadingData,
      "sales-dashboard": enSalesDashboard,
      "hr-dashboard": enHrDashboard,
      filters: enFilters,
      "language-and-theme": enLanguageAndTheme,
    },
    "admin-guide": { intro: enAdminIntro },
  },
  de: {
    "user-guide": {
      intro: deUserIntro,
      "uploading-data": deUploadingData,
      "sales-dashboard": deSalesDashboard,
      "hr-dashboard": deHrDashboard,
      filters: deFilters,
      "language-and-theme": deLanguageAndTheme,
    },
    "admin-guide": { intro: deAdminIntro },
  },
};
