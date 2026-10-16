export type LifecycleStatus = "Draft" | "In Review" | "Published" | "Archived" | "Not specified" | "Unrecognised";
export type FileAvailability = "available" | "reference-present-unverified" | "missing" | "inaccessible" | "unresolved";

export interface FileReference {
  kind: string;
  raw?: string;
  resolved?: string;
}

export interface CatalogueItem {
  id: string;
  serverItemId?: string;
  etag?: string;
  category: string;
  title: string;
  newName?: string;
  domainRaw?: string;
  domains: string[];
  description?: string;
  durationOrSlides?: string;
  versionLabel?: string;
  statusRaw: string;
  status: LifecycleStatus;
  sourceRef?: FileReference;
  publishedRef?: FileReference;
  currentDir?: string;
  currentDirLink?: FileReference;
  sourceSheet?: string;
  sourceRow?: string;
  lastUpdated?: string;
  lastUpdatedBy?: string;
  owner?: string;
  reviewer?: string;
  sourceAvailability: FileAvailability;
  publishedAvailability: FileAvailability;
  fileTypeHint?: string;
  flags: string[];
}

export interface Statistic {
  id: string;
  etag?: string;
  label: string;
  valueRaw: string;
  valueNumber?: number;
  unit?: string;
  qualifier?: string;
  approvalState: "Approved" | "Unapproved" | "Unknown";
  approvalName?: string;
  effectiveDate?: string;
  group?: string;
  inTotal?: boolean;
  fte?: number;
}

export interface Client {
  id: string;
  name: string;
  domain: string;
  logoUrl?: string;
}

export interface ReviewTask {
  id: string;
  etag?: string;
  title: string;
  taskType?: string;
  status?: string;
  itemId?: string;
  assignedTo?: string;
}

export interface CatalogueDataset {
  items: CatalogueItem[];
  statistics: Statistic[];
  clients: Client[];
  tasks: ReviewTask[];
  isMaintainer: boolean;
  purpose?: string;
  showcaseLink?: string;
}

export interface CatalogueDraft {
  stableId?: string;
  title: string;
  category: string;
  newName: string;
  domainRaw: string;
  description: string;
  status: LifecycleStatus;
  owner: string;
}

export const CATEGORIES = [
  "Presentations",
  "One-Pagers",
  "Brochures",
  "Case Studies",
  "Marketing Videos",
  "Rate Cards"
];

export const DOMAINS = ["K-12", "Higher Education", "Workforce Development", "All Domains"];
