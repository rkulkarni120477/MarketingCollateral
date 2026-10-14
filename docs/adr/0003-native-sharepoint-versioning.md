# ADR-0003: Native SharePoint versioning and check-out for file history

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

F2 requires version management that users can see and restore from the portal. The brief asks for major and minor versions, version history, and restore.

## Decision

- Turn on **major and minor versioning** on every collateral library. Keep **50 major and 10 minor** versions.
- Turn on **content approval** on every library.
- Turn on **required check-out only on `RateCards`**. Other libraries use co-authoring.
- The portal reads and restores versions through the SharePoint version APIs (PnPjs). It does not keep its own copy of files.
- A new version requires a change note. We store that note in a column on the version (`ChangeNote`), since SharePoint does not require one natively.

## Consequences

- No custom version store to maintain.
- The change note depends on how the portal writes the version. Uploads made directly in SharePoint (outside the portal) won't carry one. Document this in the user guide and add a data-quality report entry.
- Version limits are per library and are set in provisioning (ADR-0008).

## Alternatives considered

- **Store each version as a separate file.** Rejected: duplicates content and breaks links.
