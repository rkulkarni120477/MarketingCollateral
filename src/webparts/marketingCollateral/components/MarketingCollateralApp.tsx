import * as React from "react";
import {
  CATEGORIES,
  CatalogueDataset,
  CatalogueDraft,
  CatalogueItem,
  DOMAINS,
  LifecycleStatus
} from "../models/marketingCollateral";
import { CatalogueFilters, countPublishedFiles, getFilteredItems } from "../models/catalogueRules";
import { IDataProvider } from "../services/catalogueProvider";
import styles from "./MarketingCollateralApp.module.scss";

type ViewName = "overview" | "catalogue" | "statistics" | "clients" | "maintenance" | "reviews";

interface IMarketingCollateralAppProps {
  provider: IDataProvider;
  previewMode: boolean;
}

const DEFAULT_FILTERS: CatalogueFilters = {
  query: "",
  category: "",
  domain: "",
  status: "",
  sort: "title",
  descending: false
};

const STATUS_OPTIONS: LifecycleStatus[] = ["Draft", "In Review", "Published", "Archived", "Not specified"];
const PAGE_SIZE = 12;

function initialView(): ViewName {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "catalogue" || value === "statistics" || value === "clients"
      || value === "maintenance" || value === "reviews" ? value : "overview";
}

function initialFilters(): CatalogueFilters {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort");
  return {
    query: params.get("q") || "",
    category: params.get("category") || "",
    domain: params.get("domain") || "",
    status: params.get("status") || "",
    sort: sort === "updated" ? "updated" : "title",
    descending: params.get("dir") === "desc"
  };
}

function initialPage(): number {
  const parsed = Number.parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function displayDate(date?: string): string {
  if (!date) return "Not recorded";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString();
}

function referenceUrl(reference: CatalogueItem["sourceRef"]): string | undefined {
  if (!reference) return undefined;
  const target = reference.resolved;
  if (!target || reference.kind === "relative-unresolved" || reference.kind === "unc-unresolved") return undefined;
  try {
    const parsed = new URL(target);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function safeShowcaseUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeLogoUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" && url.host === window.location.host ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function availabilityLabel(value: CatalogueItem["sourceAvailability"]): string {
  switch (value) {
    case "available": return "Available";
    case "reference-present-unverified": return "Reference found; access not verified";
    case "inaccessible": return "Inaccessible";
    case "unresolved": return "Link unresolved";
    default: return "File not recorded";
  }
}

function blankDraft(category = ""): CatalogueDraft {
  return { stableId: `UI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, title: "", category: category || CATEGORIES[0], newName: "", domainRaw: "", description: "", status: "Not specified", owner: "" };
}

export function MarketingCollateralApp(props: IMarketingCollateralAppProps): React.ReactElement {
  const [dataset, setDataset] = React.useState<CatalogueDataset | undefined>();
  const [loadError, setLoadError] = React.useState<string>();
  const [view, setView] = React.useState<ViewName>(initialView);
  const [filters, setFilters] = React.useState<CatalogueFilters>(initialFilters);
  const [page, setPage] = React.useState<number>(initialPage);
  const [selected, setSelected] = React.useState<CatalogueItem>();
  const [formItem, setFormItem] = React.useState<CatalogueItem>();
  const [formDraft, setFormDraft] = React.useState<CatalogueDraft>();
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  const reload = React.useCallback((): void => {
    setLoadError(undefined);
    props.provider.load().then((loaded) => setDataset(loaded)).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : "The catalogue could not be loaded.");
    });
  }, [props.provider]);

  React.useEffect(() => { reload(); }, [reload]);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    params.set("view", view);
    const queryValues: Record<string, string> = {
      q: filters.query,
      category: filters.category,
      domain: filters.domain,
      status: filters.status,
      sort: filters.sort,
      dir: filters.descending ? "desc" : ""
    };
    Object.keys(queryValues).forEach((key) => {
      if (queryValues[key]) params.set(key, queryValues[key]);
      else params.delete(key);
    });
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    if (selected) params.set("asset", selected.id);
    else params.delete("asset");
    window.history.replaceState(null, "", url.toString());
  }, [view, filters, page, selected]);

  React.useEffect(() => {
    if (!dataset) return;
    const selectedId = new URLSearchParams(window.location.search).get("asset");
    if (selectedId) setSelected(dataset.items.find((item) => item.id === selectedId));
  }, [dataset]);

  React.useEffect(() => {
    if (!selected) return undefined;
    const returnFocusTo = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    const handleDialogKeys = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setSelected(undefined);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest("[role='dialog']");
      const focusable = dialog ? Array.prototype.slice.call(
        dialog.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")
      ) as HTMLElement[] : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.removeEventListener("keydown", handleDialogKeys);
      if (document.contains(returnFocusTo)) returnFocusTo.focus();
    };
  }, [selected]);

  const filteredItems = React.useMemo(
    () => getFilteredItems(dataset?.items || [], filters),
    [dataset, filters]
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const changeFilter = (key: keyof CatalogueFilters, value: string | boolean): void => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const showCatalogue = (category = ""): void => {
    setFilters((current) => ({ ...current, category }));
    setPage(1);
    setView("catalogue");
  };

  const openEditor = (item?: CatalogueItem): void => {
    if (!dataset?.isMaintainer) return;
    setFormItem(item);
    setFormDraft(item ? {
      title: item.title,
      category: item.category,
      newName: item.newName || "",
      domainRaw: item.domainRaw || "",
      description: item.description || "",
      status: item.status,
      owner: item.owner || ""
    } : blankDraft(filters.category));
    setActionError(undefined);
    setNotice(undefined);
    setView("maintenance");
  };

  const submitDraft = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!formDraft || !dataset?.isMaintainer) return;
    setSaving(true);
    setActionError(undefined);
    setNotice(undefined);
    try {
      if (formItem) await props.provider.updateItem(formItem, formDraft);
      else await props.provider.createItem(formDraft);
      setNotice(formItem ? "Catalogue item updated." : "Catalogue item created.");
      setFormItem(undefined);
      setFormDraft(undefined);
      await reload();
      setView("catalogue");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The item could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <main className={styles.app} aria-labelledby="mc-title">
      <h1 id="mc-title">Marketing Collateral</h1>
      <div className={styles.error} role="alert">
        <strong>Catalogue unavailable.</strong> {loadError}
        <button type="button" onClick={reload}>Try again</button>
      </div>
    </main>;
  }

  if (!dataset) {
    return <main className={styles.app} aria-labelledby="mc-title">
      <h1 id="mc-title">Marketing Collateral</h1>
      <p role="status">Loading catalogue…</p>
    </main>;
  }

  const fteComponents = dataset.statistics.filter((statistic) => statistic.fte !== undefined && statistic.inTotal);
  const fteTotal = fteComponents.reduce((total, statistic) => total + (statistic.fte || 0), 0);
  const totalClientCount = dataset.clients.length;
  const showcaseUrl = safeShowcaseUrl(dataset.showcaseLink);
  const clientCounts = dataset.clients.reduce<Record<string, number>>((counts, client) => {
    counts[client.domain] = (counts[client.domain] || 0) + 1;
    return counts;
  }, {});

  return <main className={styles.app} aria-labelledby="mc-title">
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Strategies and Solutions</p>
        <h1 id="mc-title">Marketing Collateral</h1>
        <p className={styles.intro}>{dataset.purpose || "Find, review and maintain collateral and its source information."}</p>
      </div>
      {props.previewMode && <span className={styles.preview} role="status">Local preview data</span>}
    </header>

    <nav className={styles.navigation} aria-label="Marketing collateral views">
      {([
        ["overview", "Overview"], ["catalogue", "Catalogue"], ["statistics", "Company statistics"],
        ["clients", "Clients"]
      ] as [ViewName, string][]).map(([key, label]) =>
        <button key={key} type="button" aria-current={view === key ? "page" : undefined}
          onClick={() => setView(key)}>{label}</button>)}
      {dataset.isMaintainer && <button type="button" aria-current={view === "reviews" ? "page" : undefined}
        onClick={() => setView("reviews")}>Review queue</button>}
      {dataset.isMaintainer && <button type="button" aria-current={view === "maintenance" ? "page" : undefined}
        onClick={() => openEditor()}>Maintain catalogue</button>}
    </nav>

    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}

    {view === "overview" && <section aria-labelledby="overview-heading">
      <h2 id="overview-heading">Browse collateral</h2>
      <p>Catalogue status and file availability are tracked separately. A Published status does not confirm that a file can be opened.</p>
      <div className={styles.cards}>
        {CATEGORIES.map((category) => {
          const categoryItems = dataset.items.filter((item) => item.category === category && item.status !== "Archived");
          const published = categoryItems.filter((item) => item.status === "Published").length;
          const files = countPublishedFiles(categoryItems);
          return <article key={category} className={styles.card}>
            <h3>{category}</h3>
            <p><strong>{categoryItems.length}</strong> catalogue records</p>
            <p>{published} marked Published · {files} published files confirmed available</p>
            {categoryItems.length === 0 && <p className={styles.empty}>No records yet.</p>}
            <button type="button" onClick={() => showCatalogue(category)}>View {category}</button>
            {dataset.isMaintainer && <button type="button" className={styles.linkButton}
              onClick={() => openEditor(undefined)}>Add asset</button>}
          </article>;
        })}
      </div>
      <section className={styles.summary} aria-label="Company summary">
        <h2>Company information</h2>
        <p>{fteTotal || "Not available"} FTEs in the eligible role total · {totalClientCount || "No"} client names recorded</p>
        <p>K-12: {clientCounts["K-12"] || 0} · Higher Education: {clientCounts["Higher Education"] || 0} · Workforce Development: {clientCounts["Workforce Development"] || 0}</p>
        <button type="button" onClick={() => setView("statistics")}>View statistics</button>
        <button type="button" onClick={() => setView("clients")}>View clients</button>
      </section>
      {showcaseUrl && <p><a href={showcaseUrl} target="_blank" rel="noopener noreferrer">Explore project showcases</a></p>}
    </section>}

    {view === "catalogue" && <section aria-labelledby="catalogue-heading">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="catalogue-heading">Catalogue</h2>
          <p>{filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}</p>
        </div>
        {dataset.isMaintainer && <button type="button" onClick={() => openEditor()}>Add asset</button>}
      </div>
      <div className={styles.filters} role="search" aria-label="Filter catalogue">
        <label>Search metadata
          <input type="search" value={filters.query} onChange={(event) => changeFilter("query", event.target.value)}
            placeholder="Title, description, filename or domain" />
        </label>
        <label>Category
          <select value={filters.category} onChange={(event) => changeFilter("category", event.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>Domain
          <select value={filters.domain} onChange={(event) => changeFilter("domain", event.target.value)}>
            <option value="">All domains</option>
            {DOMAINS.map((domain) => <option key={domain}>{domain}</option>)}
          </select>
        </label>
        <label>Lifecycle
          <select value={filters.status} onChange={(event) => changeFilter("status", event.target.value)}>
            <option value="">All lifecycle states</option>
            {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>Sort
          <select value={`${filters.sort}-${filters.descending ? "desc" : "asc"}`}
            onChange={(event) => {
              const [sort, direction] = event.target.value.split("-");
              setFilters((current) => ({ ...current, sort: sort as CatalogueFilters["sort"], descending: direction === "desc" }));
              setPage(1);
            }}>
            <option value="title-asc">Title A–Z</option>
            <option value="title-desc">Title Z–A</option>
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Oldest update</option>
          </select>
        </label>
        <button type="button" className={styles.linkButton} onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>Clear filters</button>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <caption className={styles.srOnly}>Marketing collateral records</caption>
          <thead><tr>
            <th scope="col">Title</th><th scope="col">Category</th><th scope="col">Domain</th>
            <th scope="col">Status</th><th scope="col">Type</th><th scope="col">Updated</th>
            <th scope="col">Owner</th><th scope="col">File availability</th>
          </tr></thead>
          <tbody>{visibleItems.map((item) => <tr key={item.id}>
            <th scope="row"><button type="button" className={styles.itemLink} onClick={() => setSelected(item)}>{item.newName || item.title}</button></th>
            <td>{item.category}</td><td>{item.domains.join(", ") || "Not specified"}</td>
            <td>{item.status}</td><td>{item.fileTypeHint || "Unknown"}</td>
            <td>{displayDate(item.lastUpdated)}</td><td>{item.owner || "Not recorded"}</td>
            <td>{availabilityLabel(item.publishedAvailability)}</td>
          </tr>)}
          {visibleItems.length === 0 && <tr><td colSpan={8} className={styles.empty}>No matching assets. Try clearing one or more filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={styles.paging} aria-label="Catalogue pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span aria-live="polite">Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>}

    {view === "statistics" && <section aria-labelledby="statistics-heading">
      <h2 id="statistics-heading">Company statistics</h2>
      {dataset.statistics.length === 0 ? <p className={styles.empty}>Statistics have not been provisioned in this data source.</p> : <>
        <p>Eligible FTE total: <strong>{fteComponents.length ? fteTotal : "Not recorded"}</strong> (components marked as included only).</p>
        {dataset.statistics.map((statistic) => <article key={statistic.id} className={styles.rowCard}>
          <h3>{statistic.label}</h3>
          <p>{statistic.valueRaw || statistic.fte || "Not specified"}{statistic.qualifier ? ` (${statistic.qualifier})` : ""}{statistic.unit ? ` ${statistic.unit}` : ""}</p>
          {statistic.fte !== undefined && statistic.inTotal && <p>Share of eligible total: {fteTotal ? `${((statistic.fte / fteTotal) * 100).toFixed(1)}%` : "Not calculated"}</p>}
          <p>Approval: {statistic.approvalState}{statistic.approvalName ? ` · ${statistic.approvalName} (identity not verified)` : ""}</p>
          <p>Effective date: {displayDate(statistic.effectiveDate)}</p>
        </article>)}
      </>}
    </section>}

    {view === "clients" && <section aria-labelledby="clients-heading">
      <h2 id="clients-heading">Client names</h2>
      <p>Client names are not evidence that a logo image is available.</p>
      {dataset.clients.length === 0 ? <p className={styles.empty}>Client records have not been provisioned in this data source.</p> :
        <div className={styles.cards}>{dataset.clients.map((client) => <article key={client.id} className={styles.card}>
          {safeLogoUrl(client.logoUrl) ? <img className={styles.logo} src={safeLogoUrl(client.logoUrl)} alt={`${client.name} logo`} /> : <div className={styles.logoFallback} aria-hidden="true">{client.name.slice(0, 1)}</div>}
          <h3>{client.name}</h3><p>{client.domain}</p><p>{client.logoUrl ? "Logo reference present; access not verified" : "Logo file not recorded"}</p>
        </article>)}</div>}
    </section>}

    {view === "reviews" && <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Review queue</h2>
      {dataset.tasks.length === 0 ? <p className={styles.empty}>No review tasks are available in this data source.</p> :
        <ul className={styles.taskList}>{dataset.tasks.map((task) => <li key={task.id}>
          <strong>{task.title}</strong><span>{task.taskType || "Review"} · {task.status || "Open"}</span>
          {task.assignedTo && <span>Assigned to {task.assignedTo}</span>}
        </li>)}</ul>}
    </section>}

    {view === "maintenance" && <section aria-labelledby="maintenance-heading">
      <h2 id="maintenance-heading">Maintain catalogue</h2>
      {!dataset.isMaintainer && <p className={styles.error} role="alert">Your account is not in the configured maintainer or owner group.</p>}
      {dataset.isMaintainer && formDraft && <form className={styles.form} onSubmit={submitDraft}>
        <label>Title <input required maxLength={255} value={formDraft.title}
          onChange={(event) => setFormDraft({ ...formDraft, title: event.target.value })} /></label>
        <label>Category <select value={formDraft.category} onChange={(event) => setFormDraft({ ...formDraft, category: event.target.value })}>
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select></label>
        <label>New name <input maxLength={255} value={formDraft.newName}
          onChange={(event) => setFormDraft({ ...formDraft, newName: event.target.value })} /></label>
        <label>Raw domain <input maxLength={100} value={formDraft.domainRaw}
          onChange={(event) => setFormDraft({ ...formDraft, domainRaw: event.target.value })} /></label>
        <label>Description <textarea rows={4} maxLength={4000} value={formDraft.description}
          onChange={(event) => setFormDraft({ ...formDraft, description: event.target.value })} /></label>
        <label>Lifecycle status <select value={formDraft.status}
          onChange={(event) => setFormDraft({ ...formDraft, status: event.target.value as LifecycleStatus })}>
          {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
        </select></label>
        <label>Owner display name <input maxLength={255} value={formDraft.owner}
          onChange={(event) => setFormDraft({ ...formDraft, owner: event.target.value })} /></label>
        {formDraft.status === "Published" && !formItem?.publishedRef && <p className={styles.warning}>This record will be marked Published without a verified published file.</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : formItem ? "Save changes" : "Create catalogue item"}</button>
          <button type="button" className={styles.secondaryButton} onClick={() => { setFormDraft(undefined); setFormItem(undefined); setView("catalogue"); }}>Cancel</button>
        </div>
      </form>}
      <p>SharePoint list and library permissions remain authoritative. File upload, protected-note editing and review-task resolution are not enabled in this build.</p>
    </section>}

    {selected && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(undefined); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>{selected.category}</p><h2 id="detail-title">{selected.newName || selected.title}</h2></div>
          <button ref={closeButtonRef} type="button" aria-label="Close asset details" onClick={() => setSelected(undefined)}>Close</button>
        </div>
        <dl className={styles.details}>
          <dt>Original title</dt><dd>{selected.title}</dd>
          <dt>Description</dt><dd>{selected.description || "Not recorded"}</dd>
          <dt>Domain</dt><dd>{selected.domainRaw || "Not specified"}{selected.domains.length ? ` (${selected.domains.join(", ")})` : ""}</dd>
          <dt>Lifecycle</dt><dd>{selected.status}{selected.status === "Not specified" ? " · Needs status review" : ""}</dd>
          <dt>Version label</dt><dd>{selected.versionLabel || "Not recorded"}</dd>
          <dt>Current directory</dt><dd>{selected.currentDir || "Not recorded"}</dd>
          <dt>Source updated</dt><dd>{displayDate(selected.lastUpdated)}{selected.lastUpdatedBy ? ` by ${selected.lastUpdatedBy}` : ""}</dd>
          <dt>Owner / reviewer</dt><dd>{selected.owner || "Owner not recorded"} · {selected.reviewer || "Reviewer not recorded"}</dd>
          <dt>Provenance</dt><dd>{selected.sourceSheet ? `${selected.sourceSheet}, row ${selected.sourceRow}` : "SharePoint catalogue item"}</dd>
          <dt>Source file</dt><dd>{availabilityLabel(selected.sourceAvailability)}</dd>
          <dt>Published file</dt><dd>{availabilityLabel(selected.publishedAvailability)}</dd>
          <dt>Review flags</dt><dd>{selected.flags.length ? selected.flags.join(", ") : "None recorded"}</dd>
        </dl>
        <div className={styles.actions}>
          {[
            ["Open source", selected.sourceRef, selected.sourceAvailability, false],
            ["Open published file", selected.publishedRef, selected.publishedAvailability, false],
            ["Open current folder", selected.currentDirLink, selected.sourceAvailability, true]
          ].map(([label, ref, availabilityValue, isFolder]) => {
            const url = referenceUrl(ref as CatalogueItem["sourceRef"]);
            const accessible = availabilityValue !== "inaccessible"
              && (isFolder === true || availabilityValue !== "missing");
            return url && accessible
              ? <a key={label as string} className={styles.buttonLink} href={url} target="_blank" rel="noopener noreferrer">{label as string}</a>
              : <button key={label as string} type="button" disabled title={!url ? "Link is missing or unresolved." : "File access is not available."}>{label as string}</button>;
          })}
          {dataset.isMaintainer && <button type="button" onClick={() => { setSelected(undefined); openEditor(selected); }}>Edit metadata</button>}
        </div>
        <p className={styles.hint}>File references are not verified by the catalogue. Opening a document uses the user&apos;s SharePoint access.</p>
      </section>
    </div>}
  </main>;
}
