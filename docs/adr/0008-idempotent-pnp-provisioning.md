# ADR-0008: Provisioning with idempotent PnP.PowerShell scripts

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

The site, term sets, content type, libraries, lists, groups, permissions, search schema and seed data must be reproducible across dev and prod. Manual set-up drifts.

## Decision

- Provision with **PnP.PowerShell** and a PnP provisioning template (XML or JSON) in `provisioning/`. Entry point: `Deploy-MarketingCollateral.ps1 -Environment <dev|prod>`.
- Every step is **idempotent**: re-running changes nothing if the target already matches.
- `-WhatIf` is supported and is the default for prod.
- A teardown script exists **for dev only**. It refuses to run against any environment other than `dev`.
- Environment values come from `config/environments/<env>.json`. No values are hard-coded in the scripts.
- Pin the PnP.PowerShell module version. Record the version in the script header.

## Consequences

- Running the script against a tenant is a live action. It is not run until the owner has seen the dry-run output (Phase 2 checkpoint).
- Some SharePoint objects (search managed properties, certain term-set changes) need a second pass. Document them in `provisioning/search-schema.md`.

## Alternatives considered

- **Manual set-up with a runbook.** Rejected: not reproducible.
- **Bicep/ARM.** Not applicable to SharePoint objects.
