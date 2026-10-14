# ADR-0004: Restricted collateral: broken inheritance and brokered access

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

F4 needs two clearance modes per type or item: **Notify** (download allowed, approver emailed) and **Approve** (download blocked until a time-limited grant). SharePoint does not raise an event on download, so the portal cannot observe a direct download of a file a user can open.

## Decision

- The `RateCards` library and any item with `Sensitivity = Restricted` has **broken inheritance**. Visitors have no direct permission on it.
- All access to restricted items goes through `mc-api`, which:
  - **Notify:** streams the file (or returns a short-lived link), writes `DownloadAudit`, evaluates `NotificationRules`, emails the approver.
  - **Approve:** creates a `ClearanceRequests` row and returns `pending`. On approval, grants item-level read until `AccessExpiresAt`. A timer revokes the grant.
- Restricted items cannot be shared. Users can only request them.
- Non-restricted downloads also go through `mc-api` where the portal wants an audit row, but the file itself is reachable by permission.

## Consequences

- Only portal-brokered downloads are fully auditable. See [security.md](../security.md) for the residual risk and the mitigations (Purview `FileDownloaded` ingestion, sensitivity labels).
- The API must enforce every permission the UI hides. UI-only checks are not security.
- Revocation depends on the timer job. Its failure is a security incident and needs an alert.

## Alternatives considered

- **Rely on SharePoint permissions alone.** Rejected: no approval workflow and no download record.
- **Sensitivity labels with encryption only.** Kept as a supplementary control (see security.md), not the main one. Labels need licences and admin set-up that we have not confirmed.
