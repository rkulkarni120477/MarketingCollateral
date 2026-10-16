import { CatalogueItem } from "./marketingCollateral";
import { catalogueListForRole, countPublishedFiles, getFilteredItems, shouldBeReaderVisible } from "./catalogueRules";

const items: CatalogueItem[] = [
  {
    id: "presentation",
    category: "Presentations",
    title: "Capabilities deck",
    newName: "Capabilities",
    domains: ["All Domains"],
    statusRaw: "",
    status: "Not specified",
    sourceAvailability: "reference-present-unverified",
    publishedAvailability: "missing",
    flags: ["NeedsStatusReview"]
  },
  {
    id: "published-with-file",
    category: "One-Pagers",
    title: "Learning overview.pdf",
    domains: ["Higher Education"],
    statusRaw: "Published",
    status: "Published",
    sourceAvailability: "missing",
    publishedAvailability: "available",
    flags: []
  },
  {
    id: "published-unverified",
    category: "One-Pagers",
    title: "Learning overview.docx",
    domains: ["Higher Education", "Workforce Development"],
    statusRaw: "Published",
    status: "Published",
    sourceAvailability: "missing",
    publishedAvailability: "reference-present-unverified",
    flags: []
  }
];

describe("catalogue filtering", () => {
  it("combines metadata search, category, domain, and lifecycle filters", () => {
    const result = getFilteredItems(items, {
      query: "overview",
      category: "One-Pagers",
      domain: "Higher Education",
      status: "Published",
      sort: "title",
      descending: false
    });
    expect(result.map((item) => item.id)).toEqual(["published-unverified", "published-with-file"]);
  });

  it("keeps literal All Domains distinct from a selected domain", () => {
    const result = getFilteredItems(items, {
      query: "",
      category: "",
      domain: "Higher Education",
      status: "",
      sort: "title",
      descending: false
    });
    expect(result.map((item) => item.id)).toEqual(["published-unverified", "published-with-file"]);
  });

  it("counts only Published items whose published file is confirmed available", () => {
    expect(countPublishedFiles(items)).toBe(1);
    expect(countPublishedFiles(items, "Presentations")).toBe(0);
  });

  it("routes readers to the published projection and keeps drafts private", () => {
    expect(catalogueListForRole(false)).toBe("MC_PublicCatalogue");
    expect(catalogueListForRole(true)).toBe("MC_Catalogue");
    expect(shouldBeReaderVisible("Published")).toBe(true);
    expect(shouldBeReaderVisible("Draft")).toBe(false);
    expect(shouldBeReaderVisible("In Review")).toBe(false);
    expect(shouldBeReaderVisible("Archived")).toBe(false);
    expect(shouldBeReaderVisible("Not specified")).toBe(false);
  });

  it("sorts by title in both directions", () => {
    const ascending = getFilteredItems(items, { query: "", category: "", domain: "", status: "", sort: "title", descending: false });
    const descending = getFilteredItems(items, { query: "", category: "", domain: "", status: "", sort: "title", descending: true });
    expect(ascending[0].title).toBe("Capabilities deck");
    expect(descending[0].title).toBe("Learning overview.pdf");
  });
});
