# Requirements: Marketing Collateral page (SnS)

Written for: the solution owner and the engineers who build and deploy this. This restates the brief as testable requirements and records status. Earlier prompts and prototypes were not used as inputs.

Status key: **Done** (built and tested locally), **Partial** (some of it built), **Not started**, **Needs tenant** (cannot be verified without SharePoint access).

## Scope and target

| ID | Requirement | Status |
| --- | --- | --- |
| R-01 | One user-facing page, `marketingcollateral.aspx` ("Marketing Collateral") in site `https://academian1.sharepoint.com/sites/sns`, target `/SitePages/marketingcollateral.aspx` | Not started (page not created; no tenant writes) |
| R-02 | Do not create another site or change the SnS home page (`CollabHome.aspx`) | Done by design (no tenant writes made) |
| R-03 | All tabs, detail panels, dialogs and admin views run inside the one page | Partial: overview, catalogue, details, statistics, clients, maintainer form and review queue are in one web part; upload and review management remain |
| R-04 | Supporting lists and libraries are allowed | Designed (see architecture.md) |
| R-05 | Verify theme, navigation, layout, permission groups and app catalog against the live site | Needs tenant |

## Workbook discovery

| ID | Requirement | Status |
| --- | --- | --- |
| W-01 | Read the workbook directly, including hidden sheets, formulas, hyperlinks, comments, validations and tables | Done (`migration/importWorkbook/workbook.py`) |
| W-02 | 90 visible catalogue records: 66 presentations, 22 one-pagers, 2 brochures; three empty categories | Done (integration test) |
| W-03 | Hidden rows never become catalogue records | Done (tests) |
| W-04 | All 66 presentation title hyperlinks extracted; blank-looking linked cells retained | Done for titles (66 extracted: 63 absolute, 3 relative). Note: no blank-looking linked cells were found in the workbook; the brief's example did not reproduce |
| W-05 | Relative links kept as unresolved; base URL never guessed | Done |
| W-06 | Home!B18 credential excluded before any output; only the exclusion is recorded | Done (tests check the value is absent from the model, report, fixture and markdown) |
| W-07 | Traceability matrix for every meaningful field, formula, link, comment and review note | Done (`docs/workbook-traceability.md`, coverage-checked by script) |

## Catalogue and assets

| ID | Requirement | Status |
| --- | --- | --- |
| C-01 | Canonical catalogue item with stable identity, source provenance and separate status and availability fields | Partial: importer model and SharePoint schemas exist; live list creation/import is not run |
| C-02 | Blank presentation status kept blank, shown as **Not specified** with NeedsStatusReview; never Published by default | Done (66 records) |
| C-03 | Published status is separate from file availability | Done (availability fields; unverified references) |
| C-04 | Search, filters (category, domain, lifecycle), sort, paging, clear filters, result count, deep links | Partial: implemented in the local web part; tenant permission trimming and browser validation remain |
| C-05 | Asset detail panel with provenance, open, preview, download; disabled actions with reasons | Partial: detail and open links implemented; explicit preview/download and live availability checks remain |
| C-06 | File types match actual files; no assumption that presentations are PowerPoint | Done in model (pptx 61, pdf 1, xlsx 1, unknown 3) |
| C-07 | Metadata search works without AI; no claim of document-content search | Partial: metadata-only search is implemented; live list data and permission trimming are unverified |

## Company statistics and client names

| ID | Requirement | Status |
| --- | --- | --- |
| S-01 | FTE total equals the formula scope (rows 3-10); 700 reproduced; rows 11-12 excluded | Done (integration test) |
| S-02 | Role percentages reproduce the denominator and handle zero or missing totals | Done (unit tests) |
| S-03 | Totals recalculate when eligible components change; derived totals not independently editable | Done in calculation; editing UI not started |
| S-04 | Qualified statistics kept as stated (500+, 30+, 5+, 200+, 5M+, 13+, 1000+) | Done |
| S-05 | Approved, unapproved and unknown states; no invented approver identities or dates | Done in model |
| S-06 | Header date 24 Aug 2026 vs statistic dates 1 Sep 2026 flagged | Done (flag raised) |
| S-07 | Hidden 550+ claims flagged against 700 FTE; no historical claim declared valid | Done (7 locations flagged) |
| S-08 | Changes to statistics create review tasks for affected collateral, or a scoped reconciliation task | Not started: statistics edit and task-generation flows are not implemented |
| S-09 | Client counts reconcile to K12 14, HE 9, WD 12, total 35 | Done (integration test) |
| S-10 | Logo file availability tracked separately from client names | Partial: logo library/schema and independent logo references exist; file availability is not populated or tenant-tested |

## Maintenance and review

| ID | Requirement | Status |
| --- | --- | --- |
| M-01 | In-page forms for add/edit, upload or replace, owners, reviewers, status, archive or restore, review resolution | Partial: add/edit metadata and lifecycle form implemented; uploads, owner/reviewer resolution, archive workflow and review resolution remain |
| M-02 | Review queue: missing metadata, unresolved owners, broken links, title changes, logo instructions, conflicting statistics, duplicates, retirement candidates, cell comments | Partial: importer flags and read-only task view exist; task creation and resolution are not implemented |
| M-03 | Internal BDM and editorial notes held in a secured store, never returned to readers, search or export | Designed; importer counts notes and never copies text |
| M-04 | Concurrency: no silent overwrite of another user's work | Partial: catalogue updates use SharePoint ETags/If-Match; conflict behavior has not been tenant-tested and is not implemented for other stores |

## Architecture, permissions and deployment

| ID | Requirement | Status |
| --- | --- | --- |
| A-01 | SPFx web part with React and TypeScript on the modern SnS page | Partial: web part and `.sppkg` build locally; page is not provisioned or published |
| A-02 | Pin SPFx, Node.js, TypeScript and React to compatible versions from the Microsoft compatibility reference | Done: SPFx 1.23.2, Node 22, TypeScript 5.8.3 and React 17.0.1 pinned; build verified using temporary Node 22 |
| A-03 | Reader, maintainer and owner capabilities mapped to verified site groups | Partial: scripts require distinct group names and store configured names; actual site groups remain unverified |
| A-04 | Permissions enforced in SharePoint storage and APIs, not by hiding buttons | Partial: private/public catalogue lists and ACL provisioning are implemented; direct API and file permissions remain untested |
| A-05 | Preview adapter with sanitized fixtures; production never falls back to mock data | Done locally: preview requires local workbench plus `?mcPreview=1`; production always uses SharePoint and surfaces errors |
| A-06 | Styles scoped to the web part; SnS branding via supported mechanisms | Partial: styles are scoped and responsive; live SnS theme/header/layout not inspected |
| A-07 | No AI, Azure APIs, shared-mailbox notifications, request systems or approval workflows as mandatory requirements | Done by design |

## Import

| ID | Requirement | Status |
| --- | --- | --- |
| I-01 | Repeatable importer, dry run as default | Done (dry run only; `--apply` refused) |
| I-02 | Sensitive content excluded before intermediate output | Done |
| I-03 | Import preview and per-category reconciliation | Done (`docs/migration-dry-run-report.md`) |
| I-04 | Normalise whitespace and zero-width characters, preserving source values | Done |
| I-05 | Native dates preserved; Excel serials supported | Done |
| I-06 | Formulas kept as provenance and re-implemented, never executed | Done |
| I-07 | Identities resolved only through authorised lookup; no guessed emails | Done (names kept, identity unresolved) |
| I-08 | Hidden evidence matched by traceable rules; unmatched held in restricted store | Partial: matching counts and restricted-list schema exist; hidden evidence is not written |
| I-09 | Stable identities so reruns do not duplicate records | Partial: deterministic IDs and unique SharePoint schema fields exist; live idempotent import is not implemented |
| I-10 | External links preserved initially; file copy only with authorised access | Done for links; copy not built |
| I-11 | Metadata-only records kept when files are unavailable | Done (availability fields) |
| I-12 | Report created, updated, unchanged, skipped, failed, unresolved; resume and rollback | Partial: dry-run reconciliation and resource rollback script exist; live import outcomes, resume and import rollback are not implemented |
| I-13 | Source workbook never overwritten; historical notes not imported as approved changes | Done (hash checked; notes not applied) |

## Acceptance evidence

Local evidence: Python tests **33 passed**; SPFx Heft tests **5 passed**; ESLint and the production SPFx package build passed under Node 22. Tenant-dependent checks (permissions, page rendering, uploads, live import, and accessibility audit) are **not** run and are listed in `docs/deployment.md`.
