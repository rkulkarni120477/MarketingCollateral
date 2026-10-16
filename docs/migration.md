# Migration (workbook import)

Written for: the engineer running the import and the owner who approves it. Status: dry run built and tested. **No live import has been run and none is possible without deployment approval.**

## Running the dry run

From the project root, with Python 3.11 and openpyxl installed:

```
python -X utf8 -B -m migration.importWorkbook --workbook MarketingCollateral.xlsx ^
  --json migration/out/model.json --markdown docs/migration-dry-run-report.md ^
  --fixture tests/fixtures/preview-catalogue.json
```

- The workbook is opened read-only. Its SHA-256 is checked before and after reading. A change aborts the run.
- `--json` writes the full model, including visible titles and links. Keep it under `migration/out/` (gitignored).
- `--markdown` writes counts and identifiers only. No hidden text and no person names.
- `--fixture` writes the sanitized preview: visible catalogue only, tenant hosts replaced, editor and reviewer names replaced.
- The sanitized fixture also includes the non-credential Home purpose and unwrapped showcase URL.
- `--apply` is refused. There is no write path to SharePoint in this build.

## Rules applied

1. Excluded cells are removed before any output. Home!B18 is excluded. A heuristic also excludes secret-looking text and records only its coordinate.
2. Text is cleaned for matching and display only. Whitespace and zero-width characters are removed. Raw values stay in the model where they are needed for provenance.
3. Dates: native dates, Excel serials and common text forms are parsed. Unparsed values are flagged.
4. Domains and statuses are normalised from config files. Blank status becomes Not specified.
5. Hyperlinks are classified: absolute, safelink (unwrapped), internal sheet, mailto, relative (unresolved), UNC (unresolved). Relative targets are never resolved.
6. Formulas are re-implemented in code: category counts, client counts, FTE total and role shares. The cached formula values are compared with the recalculated results.
7. Hidden rows are matched with a normalised name key. A match is a candidate only. Results are counts. Unmatched rows are held, not imported.
8. Comments are recorded as present or absent. Their text is never copied.

## Reconciliation (current run)

| Check | Result |
| --- | --- |
| Source unchanged after read | True |
| Presentations | 66 source rows, 66 records (all Not specified) |
| One-pagers | 22 source rows, 22 records (all Published) |
| Brochures | 2 source rows, 2 records (both Published) |
| Case Studies, Marketing Videos, Rate Cards | 0 each |
| Total visible records | 90 |
| Home formula cross-check | 66, 22, 2, 0, 0 match; Rate Cards has no formula |
| FTE total (rows 3-10) | 700; matches cached formula |
| Client counts | K12 14, HE 9, WD 12; total 35; distinct 35 |
| Exclusions | 1 (Home!B18) |
| Hidden Sheet1 | 32 named rows (2 ambiguous, 30 unmatched) and 1 notes-only row |
| Hidden one-pager legacy sheet | 32 rows, 0 title matches |
| Conflicting 550 claims | 7 cells |

Full report: `docs/migration-dry-run-report.md`.

## Idempotency and resume (planned for the live import)

Catalogue IDs are deterministic, so a dry-run rerun gives the same IDs. The live import must also:

- record each run in `MC_ImportMap` with the workbook fingerprint and run identifier;
- create items only when the ID is not already present, update only changed fields, and skip unchanged items;
- stop and report on any unresolved identity, missing mapping or failed write;
- resume from the last recorded position rather than starting over.

None of the live-import write, resume, or rollback behavior is implemented. The provisioning schema has an `MC_ImportMap` list, but no importer currently writes to it.

## What a live import would do (for approval)

See `docs/deployment.md` section "Import effects". Nothing in this list runs until approved.
