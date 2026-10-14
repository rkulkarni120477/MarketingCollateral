# MarketingCollateral

SharePoint Online portal for Academian's marketing collateral. Replaces `data/MarketingCollateral.xlsx` as the single source of truth.

**Status:** Phase 1 (discovery and scaffolding). No application code yet. Waiting on the Phase 1 checkpoint.

- Working rules, architecture summary, commands and conventions: [CLAUDE.md](CLAUDE.md)
- What is wrong with the source data, and the questions to answer: [docs/data-issues.md](docs/data-issues.md)
- Architecture: [docs/architecture.md](docs/architecture.md) · Decisions: [docs/adr/](docs/adr/README.md)
- Security model and residual risk: [docs/security.md](docs/security.md)

## Layout

```
spfx/                 SPFx solution (Phase 4)
api/                  Azure Functions, Node 22 (Phase 5)
provisioning/         PnP PowerShell provisioning (Phase 2)
migration/            Excel → SharePoint import (Phase 3)
config/environments/  dev.json, prod.json — values, no secrets
config/mappings/      proposed domain and status mappings
data/                 source workbook (not in git)
docs/                 architecture, security, data issues, ADRs
scripts/              analyse_excel.py — workbook profiler
```

## Run the workbook profiler

```powershell
python -I scripts/analyse_excel.py data/MarketingCollateral.xlsx > docs/data-profile.md
```
