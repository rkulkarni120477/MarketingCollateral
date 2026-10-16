# Architecture

Written for: engineers who build, review and deploy the solution. Status: the read-only importer and a first SPFx implementation are built. The web part builds as a package locally; no tenant deployment, permission test, live import, or browser accessibility audit has been run.

## Layers

```
SharePoint page (marketingcollateral.aspx, SnS site) [not provisioned]
  └── SPFx web part (React, TypeScript)           [built; package not deployed]
        ├── components/   overview, catalogue, asset details, statistics,
        │                 clients, maintenance form and review queue
        ├── models/       canonical catalogue and pure filter/security rules
        ├── services/     SharePoint REST provider and explicit local preview adapter
        └── styles/       scoped responsive styles

Business rules (pure TypeScript, no UI)            [filtering and reader projection implemented]
  • status normalisation, domain mapping, availability, statistics math, client counts

Import (Python, migration/importWorkbook)           [built, dry run only; no SharePoint write path]
  • read-only workbook access, exclusions, link classification,
    records, statistics, clients, hidden-evidence matching, reports, fixture
```

Separation rule: components do not call SharePoint directly. Services do. Rules do not import React.

## SharePoint resources (planned, namespaced `MC`)

| Resource | Type | Holds |
| --- | --- | --- |
| `MC_Catalogue` | List (maintainers/owners) | Private canonical catalogue, including Draft, In Review and Archived items |
| `MC_PublicCatalogue` | List (readers, maintainers, owners) | Reader-safe projection of Published records only; maintained by the web part |
| `MC_Clients` | List | Client names by domain, original spelling, normalised proposal, logo reference |
| `MC_Statistics` | List | Qualified statistics, header date, effective dates, approval state |
| `MC_StatComponents` | List | FTE components with InTotal flag; share is calculated |
| `MC_ReviewTasks` | List (maintainers/owners) | Review tasks by type, status and owner |
| `MC_SiteContent` | List | Workbook purpose, showcase URL and configured maintainer/owner group names |
| `MC_ProtectedNotes` | List (unique permissions) | Protected notes linked to items |
| `MC_LegacyEvidence` | List (unique permissions) | Hidden legacy rows and candidate matches |
| `MC_ImportMap` | List | Import runs, source fingerprint, identity map |
| `MC_SourceFiles`, `MC_Renditions`, `MC_Logos` | Libraries | Source files, published renditions, logo images |
| `MC_Confidential` | Library (unique permissions) | Files that need tighter access |

No resource is created in the tenant. `provisioning/Ensure-MarketingCollateral.ps1` creates missing namespaced resources, applies group roles and stops on unmarked name collisions. Existing resources are not modified unless they carry the solution marker and pass template/permission checks. Run its `-WhatIf` mode and review results before an approved real run.

## Toolchain (pinned from the Microsoft compatibility reference)

Checked against `https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility`:

| Component | Version | Note |
| --- | --- | --- |
| SPFx | 1.23.2 | Latest on the npm registry at check time |
| Node.js | 22 (LTS) | Required by SPFx 1.23.2. This machine has Node 24, which is not in the table. Install Node 22 before scaffolding. |
| TypeScript | 5.8 at most | Table range 2.9 to 5.8 |
| React | 17.0.1 exact | Table pins 17.0.1 with `--save-exact` |
| Build | Heft-based toolchain (SPFx 1.22 and later) | `npm run test`, `npm run lint`, and `npm run build` passed locally; the generated `.sppkg` is not tenant-validated |

The Python importer needs Python 3.11 and openpyxl 3.1.5 (both verified locally). pytest 9 runs the tests.

## Data model (summary)

Catalogue item fields follow the brief: stable `id`, category, source sheet and row, title and title link, new name, current directory and link, raw domain and normalised domains, description, duration or slides, version label, raw status and normalised status, source and published references, file availability per reference, file type hint, source update date and kind, source editor, reviewer, legacy Puneet text and review flags.

Relationships (planned): item to renditions, item to legacy-name mappings, item to duplicate candidates, item to protected notes, item to review tasks.

## Identity

Imported `StableId` values are derived from category and normalized title (`CAT-` plus 12 hex characters from SHA-1). Both catalogue lists enforce unique indexed stable IDs. User-created IDs are generated once per form submission and retained if a request must be retried.

## Preview and production

A preview adapter reads `tests/fixtures/preview-catalogue.json` (sanitized) only when running in the local SharePoint workbench with `?mcPreview=1`. Production configuration has no fallback: if SharePoint data cannot be read, the page shows an error, not fixture data.

Readers query only `MC_PublicCatalogue`. Maintainers and owners query `MC_Catalogue`; an item is written to the public projection only while its status is Published. SharePoint list ACLs are the security boundary. The provisioned ACLs and projection synchronization are not yet verified with reader/maintainer accounts; direct list access and manual list edits must be tested before production use.

## Explicit exclusions

AI features, Azure-hosted APIs, shared-mailbox notifications, request systems and approval-before-download workflows are not part of this build.
