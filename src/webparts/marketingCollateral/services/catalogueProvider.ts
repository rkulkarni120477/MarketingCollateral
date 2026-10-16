import { Environment, EnvironmentType } from "@microsoft/sp-core-library";
import { SPHttpClient, SPHttpClientResponse, ISPHttpClientOptions } from "@microsoft/sp-http";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import preview from "../../../../tests/fixtures/preview-catalogue.json";
import {
  CatalogueDataset,
  CatalogueDraft,
  CatalogueItem,
  FileAvailability,
  LifecycleStatus,
  Statistic
} from "../models/marketingCollateral";
import { catalogueListForRole, shouldBeReaderVisible } from "../models/catalogueRules";

interface ListResponse<T> {
  value?: T[];
  "@odata.nextLink"?: string;
  "odata.nextLink"?: string;
  d?: { results?: T[]; __next?: string };
}

interface SharePointListItem {
  Id: number;
  StableId?: string;
  Title?: string;
  Category?: string;
  NewName?: string;
  DomainRaw?: string;
  Domains?: string;
  Description?: string;
  LifecycleStatus?: string;
  StatusRaw?: string;
  VersionLabel?: string;
  SourceRef?: string;
  PublishedRef?: string;
  CurrentDir?: string;
  CurrentDirLink?: string;
  SourceAvailability?: string;
  PublishedAvailability?: string;
  SourceSheet?: string;
  SourceRow?: string;
  LastUpdated?: string;
  LastUpdatedBy?: string;
  Owner?: string;
  Reviewer?: string;
  ReviewFlags?: string;
  StatisticGroup?: string;
  ValueRaw?: string;
  ValueNumber?: number;
  Unit?: string;
  Qualifier?: string;
  ApprovalState?: string;
  ApprovalName?: string;
  EffectiveDate?: string;
  InTotal?: boolean;
  Fte?: number;
  Domain?: string;
  LogoUrl?: string;
  TaskType?: string;
  Status?: string;
  ItemId?: string;
  AssignedTo?: string;
  Key?: string;
  TextValue?: string;
  UrlValue?: string;
  "@odata.etag"?: string;
  "__metadata"?: { etag?: string };
  odata?: { etag?: string };
}

const LISTS = {
  catalogue: "MC_Catalogue",
  publicCatalogue: "MC_PublicCatalogue",
  statistics: "MC_Statistics",
  components: "MC_StatComponents",
  clients: "MC_Clients",
  tasks: "MC_ReviewTasks",
  content: "MC_SiteContent"
};

export interface IDataProvider {
  load(): Promise<CatalogueDataset>;
  createItem(draft: CatalogueDraft): Promise<void>;
  updateItem(item: CatalogueItem, draft: CatalogueDraft): Promise<void>;
}

const ITEM_FIELDS = [
  "Id", "StableId", "Title", "Category", "NewName", "DomainRaw", "Domains", "Description",
  "LifecycleStatus", "StatusRaw", "VersionLabel", "SourceRef", "PublishedRef", "CurrentDir", "CurrentDirLink",
  "SourceAvailability", "PublishedAvailability", "SourceSheet", "SourceRow",
  "LastUpdated", "LastUpdatedBy", "Owner", "Reviewer", "ReviewFlags"
].join(",");

function parseJsonList<T>(payload: ListResponse<T>): { items: T[]; next?: string } {
  const legacy = payload.d;
  return {
    items: payload.value || legacy?.results || [],
    next: payload["@odata.nextLink"] || payload["odata.nextLink"] || legacy?.__next
  };
}

function etagOf(item: SharePointListItem): string | undefined {
  return item["@odata.etag"] || item.__metadata?.etag || item.odata?.etag;
}

function parseReference(value?: string): CatalogueItem["sourceRef"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as CatalogueItem["sourceRef"];
    return parsed && typeof parsed === "object" ? parsed : { kind: "unresolved", raw: value };
  } catch {
    return { kind: "absolute", raw: value, resolved: value };
  }
}

function availability(value?: string): FileAvailability {
  if (value === "available" || value === "reference-present-unverified" || value === "missing"
      || value === "inaccessible" || value === "unresolved") return value;
  return value ? "reference-present-unverified" : "missing";
}

function lifecycle(value?: string): LifecycleStatus {
  if (value === "Draft" || value === "In Review" || value === "Published" || value === "Archived"
      || value === "Not specified" || value === "Unrecognised") return value;
  return "Not specified";
}

function mapCatalogueItem(item: SharePointListItem): CatalogueItem {
  return {
    id: item.StableId || String(item.Id),
    serverItemId: String(item.Id),
    etag: etagOf(item),
    category: item.Category || "Uncategorised",
    title: item.Title || "(Untitled)",
    newName: item.NewName,
    domainRaw: item.DomainRaw,
    domains: normaliseDomains(item.Domains || item.DomainRaw || ""),
    description: item.Description,
    statusRaw: item.StatusRaw || "",
    status: lifecycle(item.LifecycleStatus),
    sourceRef: parseReference(item.SourceRef),
    publishedRef: parseReference(item.PublishedRef),
    currentDir: item.CurrentDir,
    currentDirLink: parseReference(item.CurrentDirLink),
    versionLabel: item.VersionLabel,
    sourceSheet: item.SourceSheet,
    sourceRow: item.SourceRow,
    lastUpdated: item.LastUpdated,
    lastUpdatedBy: item.LastUpdatedBy,
    owner: item.Owner,
    reviewer: item.Reviewer,
    sourceAvailability: availability(item.SourceAvailability),
    publishedAvailability: availability(item.PublishedAvailability),
    fileTypeHint: item.Title?.match(/\.([A-Za-z0-9]{2,5})$/)?.[1]?.toLowerCase() || "unknown",
    flags: (item.ReviewFlags || "").split("|").map((flag) => flag.trim()).filter(Boolean)
  };
}

export class CatalogueProvider implements IDataProvider {
  private readonly webUrl: string;
  private readonly client: SPHttpClient;

  public constructor(private readonly context: WebPartContext) {
    this.webUrl = context.pageContext.web.absoluteUrl.replace(/\/$/, "");
    this.client = context.spHttpClient;
  }

  public static isLocalPreviewRequested(): boolean {
    return Environment.type === EnvironmentType.Local
      && new URLSearchParams(window.location.search).get("mcPreview") === "1";
  }

  public async load(): Promise<CatalogueDataset> {
    const [groups, content] = await Promise.all([
      this.getCurrentUserGroups(),
      this.readList<SharePointListItem>(LISTS.content, "Id,Title,Key,TextValue,UrlValue")
    ]);
    const contentByKey: Record<string, string> = {};
    content.forEach((entry) => {
      const key = entry.Key || entry.Title || "";
      const value = entry.TextValue || entry.UrlValue;
      if (key && value) contentByKey[key] = value;
    });
    const isMaintainer = groups.some((group) =>
      group === (contentByKey.MaintainerGroup || "MC Maintainers")
        || group === (contentByKey.OwnerGroup || "MC Owners")
    );
    const catalogueList = catalogueListForRole(isMaintainer);
    const [catalogue, statistics, components, clients, tasks] = await Promise.all([
      this.readList<SharePointListItem>(catalogueList, ITEM_FIELDS),
      this.readList<SharePointListItem>(LISTS.statistics, "Id,Title,ValueRaw,ValueNumber,Unit,Qualifier,ApprovalState,ApprovalName,EffectiveDate,StatisticGroup"),
      this.readList<SharePointListItem>(LISTS.components, "Id,Title,Fte,InTotal,ApprovalState,ApprovalName,EffectiveDate"),
      this.readList<SharePointListItem>(LISTS.clients, "Id,Title,Domain,LogoUrl"),
      isMaintainer
        ? this.readList<SharePointListItem>(LISTS.tasks, "Id,Title,TaskType,Status,ItemId,AssignedTo")
        : Promise.resolve([] as SharePointListItem[])
    ]);

    return {
      items: catalogue.map(mapCatalogueItem),
      statistics: [...statistics, ...components].map((item) => this.mapStatistic(item)),
      clients: clients.map((item) => ({
        id: String(item.Id),
        name: item.Title || "(Unnamed client)",
        domain: item.Domain || "Unknown",
        logoUrl: item.LogoUrl
      })),
      tasks: tasks.map((item) => ({
        id: String(item.Id),
        etag: etagOf(item),
        title: item.Title || "(Untitled task)",
        taskType: item.TaskType,
        status: item.Status,
        itemId: item.ItemId,
        assignedTo: item.AssignedTo
      })),
      isMaintainer,
      purpose: contentByKey.Purpose,
      showcaseLink: contentByKey.ShowcaseUrl
    };
  }

  public async createItem(draft: CatalogueDraft): Promise<void> {
    const stableId = draft.stableId || createStableId();
    const fields = this.itemFields(draft, stableId);
    const existing = await this.findByStableId(LISTS.catalogue, stableId);
    if (existing) {
      const etag = etagOf(existing);
      if (!etag) throw new Error("A matching stable identity exists but its SharePoint version is unavailable.");
      await this.writeItem(LISTS.catalogue, fields, String(existing.Id), etag);
    } else {
      await this.writeItem(LISTS.catalogue, fields);
    }
    await this.syncPublicRecord(stableId, shouldBeReaderVisible(draft.status), fields);
  }

  public async updateItem(item: CatalogueItem, draft: CatalogueDraft): Promise<void> {
    if (!item.etag || !item.serverItemId) throw new Error("Cannot safely update this record because its SharePoint version is unavailable.");
    const fields = this.itemFields(draft, item.id, item);
    await this.writeItem(LISTS.catalogue, fields, item.serverItemId, item.etag);
    await this.syncPublicRecord(item.id, shouldBeReaderVisible(draft.status), fields);
  }

  private async readList<T>(listTitle: string, fields: string): Promise<T[]> {
    const encodedTitle = listTitle.replace(/'/g, "''");
    const initial = `${this.webUrl}/_api/web/lists/getbytitle('${encodedTitle}')/items?$select=${fields}&$top=500`;
    const collected: T[] = [];
    let next: string | undefined = initial;
    while (next) {
      const response = await this.client.get(next, SPHttpClient.configurations.v1, {
        headers: { Accept: "application/json;odata=nometadata" }
      });
      const payload = await this.readJson<ListResponse<T>>(response, `Load ${listTitle}`);
      const page = parseJsonList(payload);
      collected.push(...page.items);
      next = page.next;
    }
    return collected;
  }

  private async getCurrentUserGroups(): Promise<string[]> {
    const endpoint = `${this.webUrl}/_api/web/currentuser/groups?$select=Title`;
    const response = await this.client.get(endpoint, SPHttpClient.configurations.v1, {
      headers: { Accept: "application/json;odata=nometadata" }
    });
    const payload = await this.readJson<ListResponse<{ Title: string }>>(response, "Read current user groups");
    return parseJsonList(payload).items.map((group) => group.Title);
  }

  private mapStatistic(item: SharePointListItem): Statistic {
    return {
      id: String(item.Id),
      etag: etagOf(item),
      label: item.Title || "(Unnamed statistic)",
      valueRaw: item.ValueRaw || (item.Fte === undefined ? "" : String(item.Fte)),
      valueNumber: item.ValueNumber ?? item.Fte,
      unit: item.Unit,
      qualifier: item.Qualifier,
      approvalState: item.ApprovalState === "Approved" || item.ApprovalState === "Unapproved"
        ? item.ApprovalState : "Unknown",
      approvalName: item.ApprovalName,
      effectiveDate: item.EffectiveDate,
      group: item.StatisticGroup,
      inTotal: item.InTotal,
      fte: item.Fte
    };
  }

  private itemFields(draft: CatalogueDraft, stableId: string, item?: CatalogueItem): Record<string, unknown> {
    return {
      StableId: stableId,
      Title: draft.title.trim(),
      Category: draft.category,
      NewName: draft.newName || null,
      DomainRaw: draft.domainRaw || null,
      Domains: normaliseDomains(draft.domainRaw).join("|") || null,
      Description: draft.description || null,
      StatusRaw: draft.status === "Not specified" ? "" : draft.status,
      LifecycleStatus: draft.status,
      VersionLabel: item?.versionLabel || null,
      SourceRef: item?.sourceRef ? JSON.stringify(item.sourceRef) : null,
      PublishedRef: item?.publishedRef ? JSON.stringify(item.publishedRef) : null,
      CurrentDir: item?.currentDir || null,
      CurrentDirLink: item?.currentDirLink ? JSON.stringify(item.currentDirLink) : null,
      SourceAvailability: item?.sourceAvailability || "missing",
      PublishedAvailability: item?.publishedAvailability || "missing",
      SourceSheet: item?.sourceSheet || null,
      SourceRow: item?.sourceRow || null,
      LastUpdated: item?.lastUpdated || null,
      LastUpdatedBy: item?.lastUpdatedBy || null,
      Owner: draft.owner || null,
      Reviewer: item?.reviewer || null,
      ReviewFlags: item?.flags.join("|") || "MissingSourceReference|MissingPublishedReference"
    };
  }

  private async findByStableId(listTitle: string, stableId: string): Promise<SharePointListItem | undefined> {
    const items = await this.readList<SharePointListItem>(listTitle, "Id,StableId");
    return items.find((item) => item.StableId === stableId);
  }

  private async syncPublicRecord(
    stableId: string,
    shouldBePublic: boolean,
    fields: Record<string, unknown>
  ): Promise<void> {
    const existing = await this.findByStableId(LISTS.publicCatalogue, stableId);
    if (!shouldBePublic) {
      if (!existing) return;
      const etag = etagOf(existing);
      if (!etag) throw new Error("The public catalogue projection cannot be removed because its SharePoint version is unavailable.");
      await this.deleteItem(LISTS.publicCatalogue, String(existing.Id), etag);
      return;
    }

    const publicFields: Record<string, unknown> = {};
    ITEM_FIELDS.split(",").forEach((field) => {
      if (field in fields) publicFields[field] = fields[field];
    });
    if (existing) {
      const etag = etagOf(existing);
      if (!etag) throw new Error("The public catalogue projection cannot be updated because its SharePoint version is unavailable.");
      await this.writeItem(LISTS.publicCatalogue, publicFields, String(existing.Id), etag);
    } else {
      await this.writeItem(LISTS.publicCatalogue, publicFields);
    }
  }

  private async writeItem(
    listTitle: string,
    values: Record<string, unknown>,
    id?: string,
    etag?: string
  ): Promise<void> {
    const escapedTitle = listTitle.replace(/'/g, "''");
    const suffix = id ? `/items(${encodeURIComponent(id)})` : "/items";
    const options: ISPHttpClientOptions = {
      headers: {
        Accept: "application/json;odata=nometadata",
        "Content-Type": "application/json;odata=nometadata",
        ...(id ? { "IF-MATCH": etag as string, "X-HTTP-Method": "MERGE" } : {})
      },
      body: JSON.stringify(values)
    };
    const response = await this.client.post(
      `${this.webUrl}/_api/web/lists/getbytitle('${escapedTitle}')${suffix}`,
      SPHttpClient.configurations.v1,
      options
    );
    await this.readJson<unknown>(response, id ? "Update catalogue item" : "Create catalogue item");
  }

  private async deleteItem(listTitle: string, id: string, etag: string): Promise<void> {
    const escapedTitle = listTitle.replace(/'/g, "''");
    const response = await this.client.post(
      `${this.webUrl}/_api/web/lists/getbytitle('${escapedTitle}')/items(${encodeURIComponent(id)})`,
      SPHttpClient.configurations.v1,
      {
        headers: { Accept: "application/json;odata=nometadata", "IF-MATCH": etag, "X-HTTP-Method": "DELETE" }
      }
    );
    await this.readJson<unknown>(response, "Remove the public catalogue projection");
  }

  private async readJson<T>(response: SPHttpClientResponse, operation: string): Promise<T> {
    if (!response.ok) {
      throw new Error(`${operation} failed (${response.status} ${response.statusText}).`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

function createStableId(): string {
  return `UI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseDomains(raw: string): string[] {
  const values = raw.split(/[|,;+]/).map((value) => value.trim().toUpperCase()).filter(Boolean);
  const mapping: Record<string, string> = {
    K12: "K-12",
    "K-12": "K-12",
    HE: "Higher Education",
    "HIGHER EDUCATION": "Higher Education",
    WD: "Workforce Development",
    "WORKFORCE DEVELOPMENT": "Workforce Development",
    AD: "All Domains",
    ALL: "All Domains",
    "ALL DOMAINS": "All Domains"
  };
  const normalized: string[] = [];
  values.forEach((value: string) => {
    if (value === "HE+WD") {
      normalized.push("Higher Education", "Workforce Development");
    } else {
      normalized.push(mapping[value] || value);
    }
  });
  return normalized.filter((value, index) => normalized.indexOf(value) === index);
}

export class PreviewCatalogueProvider implements IDataProvider {
  private items: CatalogueItem[];

  public constructor() {
    const raw = preview as unknown as { catalogue: Record<string, CatalogueItem[]> };
    this.items = [];
    Object.keys(raw.catalogue).forEach((category) => {
      raw.catalogue[category].forEach((item) => this.items.push({ ...item, etag: "preview" }));
    });
  }

  public async load(): Promise<CatalogueDataset> {
    const raw = preview as unknown as {
      homeContent?: { purpose?: string; showcaseLink?: { resolved?: string } };
      statistics: {
        fteTotal: number;
        fteComponents: Array<{ row: number; label: string; fte: number; percentOfTotal: number }>;
        outsideTotal: Array<{ row: number; label: string; fte: number }>;
        qualifiedStatistics: Array<{ row: number; label: string; value: string; effectiveDate?: string }>;
      };
      clients: Array<{ domain: string; name: string; key: string }>;
    };
    const statistics: Statistic[] = [
      ...raw.statistics.fteComponents.map((item) => ({
        id: `fte-${item.row}`,
        label: item.label,
        valueRaw: String(item.fte),
        valueNumber: item.fte,
        fte: item.fte,
        inTotal: true,
        approvalState: "Approved" as const,
        group: "FTE"
      })),
      ...raw.statistics.outsideTotal.map((item) => ({
        id: `fte-${item.row}`,
        label: item.label,
        valueRaw: String(item.fte),
        valueNumber: item.fte,
        fte: item.fte,
        inTotal: false,
        approvalState: "Unapproved" as const,
        group: "FTE"
      })),
      ...raw.statistics.qualifiedStatistics.map((item) => ({
        id: `stat-${item.row}`,
        label: item.label,
        valueRaw: item.value,
        approvalState: "Unknown" as const,
        effectiveDate: item.effectiveDate
      })),
      {
        id: "fte-total",
        label: "Eligible FTE total (formula-derived)",
        valueRaw: String(raw.statistics.fteTotal),
        valueNumber: raw.statistics.fteTotal,
        fte: raw.statistics.fteTotal,
        inTotal: false,
        approvalState: "Unknown",
        group: "FTE total"
      }
    ];
    return {
      items: this.items.map((item) => ({ ...item })),
      statistics,
      clients: raw.clients.map((client) => ({
        id: client.key,
        name: client.name,
        domain: normaliseDomains(client.domain)[0] || client.domain
      })),
      tasks: [],
      isMaintainer: true,
      purpose: raw.homeContent?.purpose,
      showcaseLink: raw.homeContent?.showcaseLink?.resolved
    };
  }

  public async createItem(draft: CatalogueDraft): Promise<void> {
    this.items = [...this.items, {
      id: draft.stableId || `preview-${Date.now()}`,
      category: draft.category,
      title: draft.title.trim(),
      newName: draft.newName || undefined,
      domainRaw: draft.domainRaw || undefined,
      domains: normaliseDomains(draft.domainRaw),
      description: draft.description || undefined,
      statusRaw: draft.status === "Not specified" ? "" : draft.status,
      status: draft.status,
      owner: draft.owner || undefined,
      sourceAvailability: "missing",
      publishedAvailability: "missing",
      flags: ["MissingSourceReference", "MissingPublishedReference"]
    }];
  }

  public async updateItem(item: CatalogueItem, draft: CatalogueDraft): Promise<void> {
    this.items = this.items.map((current) => current.id === item.id ? {
      ...current,
      title: draft.title.trim(),
      category: draft.category,
      newName: draft.newName || undefined,
      domainRaw: draft.domainRaw || undefined,
      domains: normaliseDomains(draft.domainRaw),
      description: draft.description || undefined,
      statusRaw: draft.status === "Not specified" ? "" : draft.status,
      status: draft.status,
      owner: draft.owner || undefined
    } : current);
  }
}
