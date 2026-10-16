# Replacement manifest

Written before any file was removed. Written for: the solution owner and reviewers who must confirm nothing outside this solution was touched.

## Initial replacement baseline (before local implementation)

- Project root (verified): `C:\Users\RahulSudhakar\source\repos\MarketingCollateral`
- Git: branch `main`, HEAD `aefa8b6`, `.git` present
- Tracked files: **none**. The earlier application files were removed in commits `d391f0b` through `aefa8b6` (docs, scripts, `.gitattributes`, `.gitignore`, `README.md`). They remain recoverable from history, for example `git show d391f0b^:docs/<file>`.
- Uncommitted state at start: only two untracked items, `MarketingCollateral.xlsx` and `SnS Marketing Collateral Page Implementation Prompt.md`. No tracked changes existed, so there was no uncommitted tracked work to preserve.
- Superseded application code in the working tree at that baseline: **none found**. The top-level inventory then held only `.git`, the workbook and the prompt document.

## Current local implementation

The implementation was added after that baseline. The current Git worktree has no tracked files and contains untracked project files, including the SPFx application, configuration, provisioning scripts, importer, tests, and documentation. These files are intentionally not described as tenant-deployed or verified against SharePoint. Review `git status --short` before staging or committing.

## Source fingerprints

| Item | Fingerprint | Treatment |
| --- | --- | --- |
| `MarketingCollateral.xlsx` | SHA-256 `95f762ca927246f766c5e44ad0d678866378ec044c62c17e7f49f7bb307305b2` | Retained, never written. Current hash rechecked during this review. Excluded from Git by `.gitignore`. |
| `SnS Marketing Collateral Page Implementation Prompt.md` | not recorded (not a requirements input) | Retained untouched. Excluded from Git by `.gitignore` (see note below). |

Note: the `.gitignore` entry for the prompt document is a choice made in this pass. It keeps the file out of accidental commits. Remove the entry if the file should be tracked.

## Backup

No backup was created because there were no superseded files to back up. If a later step removes application files, the backup must be written to an approved location outside the project and kept out of source control.

## Remove

None. No superseded application files exist in the working tree.

## Retain (unchanged)

- `.git/`
- `MarketingCollateral.xlsx`
- `SnS Marketing Collateral Page Implementation Prompt.md`

## Create

| Path | Purpose |
| --- | --- |
| `.gitignore` | Keeps workbook, backups, restricted stores, generated output and dependencies out of Git |
| `pytest.ini` | Test configuration |
| `README.md` | Entry point |
| `config/mappings/domain-mappings.json` | Domain mapping assumptions (configurable) |
| `config/mappings/status-rules.json` | Lifecycle values and blank-status rule |
| `config/mappings/workbook-exclusions.json` | Excluded cells (Home!B18) |
| `config/mappings/category-sheets.json` | Source sheet to category column map |
| `config/`, `provisioning/`, `src/` | SPFx build configuration, list schema/scripts, and locally implemented web part |
| `migration/__init__.py`, `migration/importWorkbook/*.py` | Read-only dry-run importer |
| `migration/out/` | Generated model and report (gitignored) |
| `scripts/generate_traceability.py` | Generates the traceability matrix and fails on coverage gaps |
| `tests/`, `tests/fixtures/preview-catalogue.json` | Python reconciliation tests, SPFx tests, and sanitized preview fixture |
| `docs/*.md` | Requirements, decisions, traceability, migration, permissions, architecture, deployment, rollback, manifest |

## Explicit preservation statement

The local implementation files are untracked additions in the current worktree; no previous application files were overwritten or removed. The workbook was opened read-only and its hash remains unchanged.
