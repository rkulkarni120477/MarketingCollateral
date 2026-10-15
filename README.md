# MarketingCollateral

SharePoint Online portal for Academian's marketing collateral. Replaces `data/MarketingCollateral.xlsx` as the single source of truth.

**Status:** Phase 1 (discovery and scaffolding) complete, pending Phase 2 approval. No application code yet.

## Documents

- Working rules, architecture summary, commands and conventions: [docs/CLAUDE.md](docs/CLAUDE.md)
- Source-data findings and decisions: [docs/data-issues.md](docs/data-issues.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Decisions (ADRs, all accepted): [docs/adr/](docs/adr/README.md)
- Security model and residual risk: [docs/security.md](docs/security.md)
- AI terms used in the product: [docs/glossary-ai.md](docs/glossary-ai.md)
- Brand (logo and colours): [config/brand/theme.json](config/brand/theme.json)

## Layout

```
spfx/                 SPFx solution (Phase 4)
api/                  Azure Functions, Node 22 (Phase 5)
provisioning/         PnP PowerShell provisioning (Phase 2)
migration/            Excel to SharePoint import (Phase 3)
config/environments/  dev.json, prod.json: values, no secrets
config/mappings/      domain, sensitivity and owner mappings
config/brand/         logo and theme
data/                 source workbook (not in git)
docs/                 architecture, security, data issues, ADRs, glossary
scripts/              analyse_excel.py: workbook profiler
.githooks/            secret-scan pre-commit hook
```

## Setup

```powershell
git config core.hooksPath .githooks
python -I scripts/analyse_excel.py data/MarketingCollateral.xlsx > docs/data-profile.md
```
