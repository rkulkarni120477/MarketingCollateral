# Deployment

Written for: the site owner, who must give explicit approval before anything touches the live SnS site. **Status: nothing has been deployed, provisioned, published or imported.** The local SPFx package and first-pass PnP scripts exist; this file is the approval request and deployment boundary.

## Target

- Site: `https://academian1.sharepoint.com/sites/sns`
- Page: `SitePages/marketingcollateral.aspx`, title "Marketing Collateral"
- Home page `SitePages/CollabHome.aspx`: **not changed**

## Resources to create (planned; none exist by this project)

| Resource | Type | Created by | Exists already? |
| --- | --- | --- | --- |
| `marketingcollateral.aspx` | Modern page with one SPFx web part | Provisioning script | To check; script must stop if it exists |
| `MC_Catalogue` | Maintainer/owner-only list for private lifecycle states | Provisioning script | To check |
| `MC_PublicCatalogue` | Reader-visible projection of Published items only | Provisioning script | To check |
| `MC_Clients`, `MC_Statistics`, `MC_StatComponents`, `MC_SiteContent` | Lists | Provisioning script | To check |
| `MC_ReviewTasks`, `MC_ImportMap` | Maintainer/owner-only lists | Provisioning script | To check |
| `MC_ProtectedNotes`, `MC_LegacyEvidence` | Owner-only lists (unique permissions) | Provisioning script | To check |
| `MC_SourceFiles`, `MC_Renditions`, `MC_Logos` | Document libraries | Provisioning script | To check |
| `MC_Confidential` | Restricted library | Provisioning script | To check |
| Reader, Maintainer, Owner groups | Existing SharePoint permission groups | Supplied and verified by site owner; script does not create groups | To check |
| SPFx package `marketing-collateral.sppkg` | App in tenant or site app catalog | Admin deploys package | Requires app catalog check |

## Permission changes (planned)

- The script requires three existing, distinct, verified SharePoint groups: Reader, Maintainer and Owner. It does not create groups or add people.
- It breaks inheritance on solution-owned lists and libraries. Standard resources grant Reader read, Maintainer contribute, Owner full control. The private catalogue, tasks and import map grant Maintainer/Owner. Protected notes and legacy evidence grant Owner only. Confidential files grant Maintainer/Owner.
- Readers query `MC_PublicCatalogue`, which contains Published records only. `MC_Catalogue` is not reader-accessible. The projection synchronization is implemented in the web part but is not tenant-tested.
- No change to site-wide permissions, membership of other groups, or any other list or page.

## Required permissions

| Action | Who | Note |
| --- | --- | --- |
| Create lists, libraries and page | Site owner | Script requires an active connection to the exact SnS site and verified existing groups |
| Apply list/library permissions | Site owner | Script targets namespaced solution resources only |
| Deploy the SPFx package | Tenant admin or app-catalog owner | Site ownership does not grant this. Verify the app catalog exists and the package is trusted. See [Microsoft app catalog guidance](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/site-collection-app-catalog). |
| Read the workbook | Owner | Local file; not uploaded anywhere |

## Local and tenant commands (tenant commands not run)

```
# Local: Node 22 LTS, SPFx 1.23.2
npm ci
npm run test
npm run lint
npm run build

# Tenant: only after explicit approval and package deployment
provisioning/Test-MarketingCollateral.ps1 -SiteUrl https://academian1.sharepoint.com/sites/sns
provisioning/Ensure-MarketingCollateral.ps1 -SiteUrl https://academian1.sharepoint.com/sites/sns `
  -ReaderGroup '<verified reader group>' -MaintainerGroup '<verified maintainer group>' `
  -OwnerGroup '<verified owner group>' -WhatIf
```

The local package is generated at `sharepoint/solution/marketing-collateral.sppkg`. PnP scripts are written but have not been run against this tenant. Review `-WhatIf` output before any real run. `Ensure-MarketingCollateral.ps1` creates the page only with the additional `-CreatePage` switch, after package deployment and approval. A resource name collision or unmarked pre-existing resource causes the script to stop rather than replace it.

## Import effects (planned; no live importer exists)

A future, separately implemented live import would:

1. Create 90 catalogue items: 66 presentations (status Not specified), 22 one-pagers (Published), 2 brochures (Published). Each keeps its source row and cell reference.
2. Create 35 client records (14 K12, 9 HE, 12 WD).
3. Create 8 eligible FTE components and 2 outside-total components, and 7 qualified statistics.
4. Store the link references: 66 title links, 64 folder links, 19 source and 19 published links for one-pagers, and 2 source links for brochures. No file is copied.
5. Store 65 hidden legacy rows in `MC_LegacyEvidence` (restricted): 33 from Sheet1 (including 1 notes-only row) and 32 from the one-pager legacy sheet.
6. Store protected notes in `MC_ProtectedNotes` (restricted).
7. Create review tasks for conflicting statistics (7 locations), unresolved owners, relative links, missing published files, Not specified status, and logo instructions.

No live importer exists today. A future importer must not publish or generate any PDF, copy any file, resolve any identity, change any approval, delete any record, or change the home page without explicit scope and approval.

## Checks

| Check | Local | Tenant |
| --- | --- | --- |
| Workbook dry run and reconciliation (`pytest`) | **Run: 33 passed** | — |
| Traceability coverage (`scripts/generate_traceability.py`) | **Run: passed** | — |
| SPFx build/package (`npm run build`) | **Run: passed** using Node 22; `.sppkg` generated | — |
| SPFx Heft tests and ESLint | **Run: 5 passed; lint passed** | — |
| UI/service browser tests | Not written | — |
| Accessibility (WCAG 2.2 AA) and mobile layout | Not run | Needs a browser on the built page |
| Reader and maintainer direct API/file permission tests | Not run | **Needs tenant** |
| Page rendering and theme check on CollabHome-style layout | Not run | **Needs tenant** |
| File open, preview and download | Explicit preview/download controls are not implemented | Direct access needs tenant verification |
| Live import and idempotency | **No live write importer is implemented** | Requires design, approval and tenant |

A static preview is not evidence of working SharePoint permissions, downloads or migration.

## Approval requested

To proceed, the site owner should confirm in writing:

1. The page, lists and libraries above may be created on SnS, and no existing page/resource will be replaced.
2. Unique permissions may be applied to solution-owned resources as described above.
3. The exact Reader, Maintainer and Owner SharePoint group names are verified and approved.
4. A tenant/app-catalog owner may deploy `sharepoint/solution/marketing-collateral.sppkg`.
5. Whether a future live importer may be designed and run after its dry run, reconciliation and rollback are reviewed. No live importer exists today.
6. Answers to the open business questions in `docs/data-decisions.md`.

The PnP scripts have been syntax-checked locally. An owner-approved read-only preflight was attempted, but interactive PnP sign-in failed because no valid Entra app client ID was configured; no PnP connection was established and no tenant state was read or changed. Neither `-WhatIf` nor a write operation has run. Provisioning and page publishing remain blocked until the three group names are verified, an approved PnP app client ID is available, and the SPFx package is deployed by the app-catalog owner. The public/private projection and ACLs must be tested with reader and maintainer accounts before production data is loaded.

## Rollback

See `docs/rollback.md`.
