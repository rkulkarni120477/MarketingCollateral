# Marketing Collateral (SnS)

Replaces the Marketing Collateral workbook with one page in the SnS SharePoint site: `marketingcollateral.aspx`.

**Status:** the workbook importer, SPFx web part, local preview, and first-pass provisioning/rollback scripts are built. The SPFx package builds locally. Nothing has been deployed, provisioned, permission-tested, or imported in the live SnS tenant.

## Start here

| Document | For |
| --- | --- |
| [docs/deployment.md](docs/deployment.md) | The approval request: resources, permissions, import effects |
| [docs/data-decisions.md](docs/data-decisions.md) | Assumptions and the questions the owner must answer |
| [docs/requirements.md](docs/requirements.md) | Requirements with status |
| [docs/workbook-traceability.md](docs/workbook-traceability.md) | Where every source field, formula, link and note goes |
| [docs/migration-dry-run-report.md](docs/migration-dry-run-report.md) | Dry-run reconciliation |
| [docs/permissions.md](docs/permissions.md) | Reader, maintainer and owner model |
| [docs/architecture.md](docs/architecture.md) | Layers, toolchain pins, resources |
| [docs/migration.md](docs/migration.md) | Importer rules and how to run it |
| [docs/rollback.md](docs/rollback.md) | How to undo this solution's changes |
| [docs/replacement-manifest.md](docs/replacement-manifest.md) | What was checked, kept, removed and created |

## Running the checks

Requires Python 3.11, `openpyxl` 3.1.5 and `pytest`. SPFx requires Node.js 22 LTS. From the project root:

```
python -X utf8 -B -m pytest -p no:cacheprovider
python -X utf8 -B scripts/generate_traceability.py --workbook MarketingCollateral.xlsx
python -X utf8 -B -m migration.importWorkbook --workbook MarketingCollateral.xlsx --markdown docs/migration-dry-run-report.md --fixture tests/fixtures/preview-catalogue.json
npm ci
npm run test
npm run lint
npm run build
```

The local sanitized web-part preview is enabled only in the local SharePoint workbench with `?mcPreview=1`. Production always uses SharePoint lists and shows an explicit error if they cannot be read; it never falls back to preview data.

The workbook is excluded from Git. Tests that need it are skipped when it is absent.

## Status

| Part | State |
| --- | --- |
| Workbook importer (dry run, read-only source) | Built, 33 tests passing |
| Traceability matrix with coverage check | Built |
| Sanitized preview fixture | Built; includes overview content, visible records, statistics and clients |
| SPFx web part (React, TypeScript) | Implemented; 1.23.2 production package builds on Node 22 |
| Provisioning and rollback scripts | Implemented but not run; requires verified site groups, package deployment and owner approval |
| Live import | Not implemented; dry-run only. Needs deployment approval and a separate idempotent importer |
| Tenant checks (permissions, page, files) | Not run. Needs tenant access |

The catalogue reader uses a separate `MC_PublicCatalogue` projection. The maintainer/owner-only `MC_Catalogue` list holds private lifecycle states; the web part projects records into the reader list only when their lifecycle is Published. The permission model and this projection have not been validated in the tenant.

## Rules that matter

- Source data is never changed. The workbook is opened read-only and checked by hash.
- Home!B18 holds a credential. It is excluded before any output and never appears in any file in this repo.
- Hidden legacy rows are evidence, not catalogue records.
- Blank status stays blank in the data and shows as "Not specified".
- Protected notes and historical figures are not reader content.
