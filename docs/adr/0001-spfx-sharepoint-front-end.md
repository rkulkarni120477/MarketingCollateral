# ADR-0001: SharePoint Online + SPFx as the front end and system of record

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

Academian's collateral lives in a spreadsheet and in personal OneDrive folders. Users are Entra ID staff. The brief requires SSO, document libraries with versioning, check-out, and permission-trimmed search, all without custom auth.

## Decision

- Store files in SharePoint document libraries and metadata in SharePoint lists. These are the system of record.
- Build the UI as SPFx web parts on a communication site.
- Use **React 17**, the React version the current GA SPFx line supports (see below). Use **Fluent UI v9** for components and **PnPjs v4** for data access. TypeScript strict mode.
- **Pin the SPFx line at scaffold time to the latest GA release**, verified on the official compatibility page. At the time of writing that is **1.23** (React 17). **1.24** (React 18) was in beta at the August 2026 roadmap update. Move to 1.24 when it reaches GA and is verified.

## Consequences

- Native versioning, permissions, search and Office Online editing come for free. We don't build them.
- Web parts run in the SharePoint page context, so CSP and SPFx rules apply.
- The **hosted workbench is retired on 1 December 2026** (per the Microsoft roadmap update). Development uses the local workbench and a dev test page on `/sites/MarketingCollateral-Dev`. Nothing depends on the hosted workbench.
- React 17 stops being the target once SPFx 1.24 (React 18) is GA and verified. Plan the upgrade then. Track it in an issue, not in code.
- Node version required by SPFx 1.23 must be verified on the compatibility page before scaffolding. This repo's default Node on the dev machine is 24.19.0, which may not be supported. Use Node 22 LTS via a version manager for SPFx builds if needed.

## Alternatives considered

- **Power Apps / Power Pages.** Weaker control over restricted-download brokering and over accessible custom UI.
- **Custom SPA on Azure Static Web Apps.** Needs custom auth and a second permission model. Rejected: the brief says "no custom auth".
