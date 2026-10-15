# ADR-0009: Excel migration: dry run by default, no secrets, no personal OneDrive

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

The workbook is the current source of truth and contains: a plaintext password (`Home!B18`), internal BDM comments, 16 links to personal OneDrive, conflicting hidden-sheet decisions, and blank status on every presentation. See [data-issues.md](../data-issues.md).

## Decision

- The importer (Phase 3, `migration/import-catalogue`) runs in **dry-run mode by default**. It writes a report (`migration/report.csv`: matched, missing file, ambiguous) and changes nothing. Writing requires an explicit `--apply` and a named environment.
- It maps every row using the column map in brief §6.2, the domain and status mappings in `config/mappings/`, and the decisions you confirm in the Phase 1 checkpoint.
- It **never imports** the Home-sheet credential, the internal BDM comments into Visitor-visible fields, or the personal OneDrive links as the document location.
- File copy: locate each source file (from a local folder you provide, or OneDrive access you grant), copy it into the library, set metadata, and keep the original as version 1.0.
- Hidden sheets are read but treated as secondary: they fill blanks and feed the duplicate list. Visible catalogues win on conflict (pending your answer to Q5).

## Consequences

- Dry run must be reviewed before any apply (Phase 3 checkpoint).
- Some rows will need manual decisions. The report lists them.
- Rate cards, case studies and videos are not in the workbook. Users upload them through the portal, so the importer does not need them.
- The workbook stays out of git (`.gitignore`).

## Alternatives considered

- **Import by hand.** Rejected: 90+ rows with mixed rules, and no audit trail.
