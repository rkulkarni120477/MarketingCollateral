import { CatalogueItem, LifecycleStatus } from "./marketingCollateral";

export interface CatalogueFilters {
  query: string;
  category: string;
  domain: string;
  status: string;
  sort: "title" | "updated";
  descending: boolean;
}

export function matchesFilters(item: CatalogueItem, filters: CatalogueFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase();
  const searchable = [
    item.title,
    item.description,
    item.newName,
    item.domainRaw,
    ...item.domains
  ].filter(Boolean).join(" ").toLocaleLowerCase();

  return (!query || searchable.includes(query))
    && (!filters.category || item.category === filters.category)
    && (!filters.domain || item.domains.indexOf(filters.domain) >= 0)
    && (!filters.status || item.status === filters.status);
}

export function getFilteredItems(items: CatalogueItem[], filters: CatalogueFilters): CatalogueItem[] {
  const result = items.filter((item) => matchesFilters(item, filters));
  result.sort((left, right) => {
    const comparison = filters.sort === "updated"
      ? (left.lastUpdated || "").localeCompare(right.lastUpdated || "")
      : left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    return filters.descending ? -comparison : comparison;
  });
  return result;
}

export function countPublishedFiles(items: CatalogueItem[], category?: string): number {
  return items.filter((item) =>
    item.status === "Published"
      && item.publishedAvailability === "available"
      && (!category || item.category === category)
  ).length;
}

export function catalogueListForRole(isMaintainer: boolean): "MC_Catalogue" | "MC_PublicCatalogue" {
  return isMaintainer ? "MC_Catalogue" : "MC_PublicCatalogue";
}

export function shouldBeReaderVisible(status: LifecycleStatus): boolean {
  return status === "Published";
}
