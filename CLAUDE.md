# CLAUDE.md — MarketingCollateral (Academian)

Working memory for Claude Code sessions. Read this first. Keep it current when decisions change.

## What we are building

**MarketingCollateral** — a SharePoint Online portal for Academian's marketing collateral (presentations, one-pagers, brochures, case studies, videos, rate cards). It replaces `data/MarketingCollateral.xlsx` as the single source of truth.

- Users: Academian staff only (Entra ID SSO). Primary consumers: Sales and Account Managers (AMs). Primary maintainers: Marketing.
- The full brief (`MarketingCollateral_ClaudeCode_Prompt.md`) lives outside this repo. The points that matter for building are repeated here, in `docs/architecture.md`, and in the ADRs.
- Tenant (inferred from workbook links, **unconfirmed**): `https://academian1.sharepoint.com`
- Clearance authority (inferred, **unconfirmed**): Kaushal Jha, `kaushalj@academian.com`

## Working rules (from the brief — do not relax)

1. Work phase by phase (brief §10). At the end of each phase: summarise, list files changed, run tests/lint, **stop for approval**.
2. **Never run against the live tenant** (provisioning, `gulp deploy`, `func ... publish`, Graph writes) without asking first and showing the exact command. Default target: `/sites/MarketingCollateral-Dev`.
3. No tenant-specific values in code. Put tenant URL, emails, group names and Azure resource names in `config/environments/*.json`.
4. Do not invent facts about the data. Ambiguities go in `docs/data-issues.md`, then ask.
5. **Never migrate the plaintext password** found in the workbook (`Home!B18`). Do not copy it into code, config, docs or logs.
6. Prefer boring, supported Microsoft patterns. Pin all package versions.
7. Commit and push only when asked. Do not create a git repo or commit without asking (see Open decisions).

## Architecture (summary — details in docs/architecture.md and docs/adr/)

- **System of record:** SharePoint document libraries (files) + SharePoint lists (requests, clearance, audit, config).
- **Front end:** SPFx web parts (React, Fluent UI v9, PnPjs v4) on a communication site.
- **Backend:** Azure Functions `mc-api` (TypeScript, **Node 22 LTS** — see ADR-0002), Entra ID Easy Auth, called from SPFx with `AadHttpClient`.
- **Brokering:** all restricted downloads and clearance decisions go through `mc-api`.
- **Email:** Graph `sendMail` from a shared mailbox, restricted with an Exchange application access policy.
- **Change detection:** library webhooks → Graph delta; 15-minute timer as fallback.
- **AI (feature-flagged, off-by-default until Phase 6):** Azure OpenAI (chat + `text-embedding-3-large`), Azure AI Search. Non-AI search must work fully when AI is off.
- **Provisioning:** idempotent PnP.PowerShell scripts in `provisioning/`, parameterised per environment.

## Repo layout

```
/spfx            SPFx solution (all web parts; shared code in spfx/src/common/)
/api             Azure Functions (TypeScript, Node 22)
/provisioning    PnP PowerShell scripts, site template, term sets, search schema
/migration       Excel → SharePoint import + file copy
/config/environments  dev.json, prod.json (no secrets)
/config/mappings     proposed domain/status mappings (to confirm)
/data            source workbook (gitignored — see .gitignore)
/docs            architecture, security, data issues, ADRs, runbooks, user guide
/scripts         helpers (analyse_excel.py, ...)
```

## Commands

Phase 1 (available now):

```powershell
# Profile the workbook (all sheets incl. hidden) to stdout (Markdown)
python -I scripts/analyse_excel.py data/MarketingCollateral.xlsx > docs/data-profile.md

# Dump raw non-empty rows for review. The output includes the workbook's credential cell
# (Home!B18): keep it on your screen only, never write it to a file in the repo.
python -I scripts/analyse_excel.py data/MarketingCollateral.xlsx --dump
```

Later phases (not yet scaffolded): `npm test` / `npm run lint` in `spfx/` and `api/`; `provisioning/Deploy-MarketingCollateral.ps1 -Environment dev -WhatIf`. Document real commands here once they exist.

## Conventions

- **TypeScript:** strict mode everywhere. Shared models in a `/shared` package used by SPFx and API (no drift).
- **Formatting/linting:** ESLint + Prettier. ≥ 70 % unit-test coverage on API and shared hooks.
- **Tests:** Jest + React Testing Library; axe-core checks on every web part (WCAG 2.2 AA is a hard requirement).
- **Python** is used only for repo utility scripts (`scripts/`, `migration/` helpers if needed) — the workbook profiler uses `openpyxl`. Run with `python -I` when reading untrusted files.
- **Prompts:** AI system prompts live in versioned files under `api/src/ai/prompts/` (Phase 6).
- **Email templates:** `api/src/templates/`, HTML, branded, accessible, with a "why am I getting this" footer.
- **Config values:** `config/environments/<env>.json`. Mark unconfirmed values with `"status": "unconfirmed"` until the user confirms.
- **ADRs:** one decision per file in `docs/adr/NNNN-title.md`. Add one whenever a decision changes.

## Data facts that matter (full list: docs/data-issues.md)

- Workbook: `data/MarketingCollateral.xlsx` (sha256 `95F762CA…05B2`). A second copy, `MarketingCollateral (1).xlsx` in Downloads, has **identical cell content** (only file metadata differs). Used the one named in the brief.
- Counts (match Home dashboard): Presentations 66, One-Pagers 22, Brochures 2, Case Studies 0, Marketing Videos 0, **Rate Cards 0** (Home count cell is blank — no rows, no formula).
- **Status is blank for all 66 presentations**, and Source/Published PDF are blank for all presentations. The brief's rule "blank → Under Revision" would import all 66 as Under Revision. Needs a decision.
- Dates are native Excel date cells, not serial numbers (the brief's `46276` example does not occur). Serial conversion is still implemented defensively in the import.
- Domain codes in use: `AD` (61 presentations, 13 one-pagers, 2 brochures), `K12`, `K-12` (hidden sheet), `HE`, `WD`, `HE+WD`, `ALL` (hidden sheet). `AD` vs `ALL` both mean "All Domains" — assumed, to confirm.
- Stats: `FTEs` = 700 is `SUM(G3:G10)` on `Logos_Stats`; rows 11–12 (Accessibility 50, Trained Editorial 25) sit outside the sum and have approval "TBD". Collateral text says "550+" in 7 cells on the hidden sheet.
- Logo list (35) includes entries the hidden sheets mark "Missing" (CFA Institute, Springer, Crimson, FullBloom, Renaissance) and one marked "To REMOVE" (Benchmark Education).

## Open decisions (ask before Phase 2)

See `docs/data-issues.md` § "Decisions needed". Summary: tenant/site/groups/emails, domain code `AD`, default status for blank rows, which workbook copy is authoritative, Node 22 vs 20, whether the workbook itself is kept in git, the rate-card source files, and brand assets.

## Security notes

- Residual risk for downloads outside the portal is documented in `docs/security.md`.
- No secrets in the repo. `.gitignore` excludes `data/*.xlsx`, `.env*`, and local settings. The secret-scan pre-commit hook is deferred until git is set up (Open decisions).
