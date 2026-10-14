# Security — MarketingCollateral

Written for: the project owner (approval of residual risk) and developers (what the controls must do).
Status: **draft for Phase 1 checkpoint.** Nothing here is deployed.

## 1. Identity and access

- Users sign in with Entra ID SSO. No custom authentication.
- Roles map to SharePoint groups, which are backed by Entra security groups or mail-enabled distribution lists (brief §5). Names are config values, not code.

| Portal role | Backed by | Rights |
|---|---|---|
| Portal Admin | `SG-MC-Admins` (proposed) | Full control, admin page, config lists |
| Contributor | `SG-Marketing` (proposed) | Upload, edit, rename, version, publish and archive, manage requests |
| Approver | `SG-MC-Approvers` (proposed) | Approve clearance, read restricted items |
| Visitor (Sales / AM) | `DL-Sales`, `DL-AMs` (proposed) | Browse, search, download, share (org-only), raise requests |
| Restricted reader | Granted per item | Time-limited read, revoked by timer |

**Rules**

- The UI hides actions a user cannot perform (checks `EffectiveBasePermissions` and group membership). **The server must enforce the same checks.** UI hiding is not a control.
- Every `mc-api` endpoint validates the Entra token (Easy Auth, plus app-level role or group checks) and validates input.

## 2. Data protection

- **Restricted items** (RateCards and any `Sensitivity = Restricted`) have broken inheritance. Visitors cannot open them in SharePoint. All access goes through `mc-api` ([ADR-0004](adr/0004-restricted-collateral-brokered-access.md)).
- **Sharing:** organisation-scoped links only. Anonymous links are disabled at the site level. Restricted items cannot be shared.
- **Sensitivity defaults** per type are config, not code. Candidates for Confidential or Restricted are listed in [data-issues.md](data-issues.md) (Q11). Not decided.
- **Sensitivity labels** on rate cards are a recommended supplementary control. They need licences and admin set-up that have not been confirmed.

## 3. Secrets and configuration

- No secrets in the repo. `.gitignore` excludes `.env*`, `local.settings.json`, `*.pfx`, `*.key`, and `data/*.xlsx`.
- Runtime secrets live in **Azure Key Vault**, read through **managed identity**. No connection strings in app settings.
- The **plaintext password** in the workbook (`Home!B18`) is **not** migrated, not stored, and not reproduced in any repo file. It must be rotated, and the showcase page it protects checked (data-issues Q14).
- A **secret-scan pre-commit hook** is required (brief §11). It is deferred until the repo is under git (data-issues Q16).

## 4. Graph and tenant permissions (least privilege)

| Permission | Scope | Why |
|---|---|---|
| `Sites.Selected` | This site only (granted per site) | Libraries and lists |
| `Mail.Send` | Restricted to the shared mailbox via Exchange application access policy | Notifications |
| `Group.Read.All` | Tenant (read) | Resolve group membership for permission checks |
| Delta / webhook access | Via the site grant | Change detection ([ADR-0005](adr/0005-change-detection-webhooks-delta.md)) |

- Granting `Mail.Send` without the Exchange policy gives access to every mailbox. The policy is part of the deployment, not optional.
- Any permission beyond this list needs a new ADR.

## 5. Audit

- Every download, share, clearance decision, request change and notification is written to a SharePoint list (`DownloadAudit`, `ClearanceRequests`, `NotificationLog`).
- App Insights gets correlation IDs from SPFx through to the API. AI prompts and responses are logged **without** file content.
- Deletions require Admin and are logged. The Archive library is retained, not deleted.

## 6. Residual risk: downloads that bypass the portal

**The risk.** SharePoint does not raise an event when a user downloads a file they can open. If a visitor can open a file in a library (for example a non-restricted deck), the portal cannot record that download. Even restricted libraries can be bypassed by a user with a permitted role who downloads the file directly.

**What we can and cannot do.**

- Only **portal-brokered downloads are fully tracked**. Anything downloaded straight from SharePoint is not.
- We can reduce the gap but not close it:
  1. **Restricted libraries** (broken inheritance) for rate cards and any restricted item, so visitors cannot open them directly.
  2. **Microsoft Purview audit log** ingestion (`FileDownloaded` and related operations) as a secondary audit source. This is a delayed, best-effort record, not real-time, and it depends on the tenant's audit licence.
  3. **Sensitivity labels with encryption** on the highest-risk items (rate cards), if licensed.
  4. **Retention label** suggestion for rate cards (brief §11).
  5. **Clear user guidance** that the audit trail covers portal downloads.

**Residual risk accepted by:** _pending the project owner's sign-off at the Phase 1 checkpoint._ Until then, treat the rate-card download and clearance flow as not production-ready.

## 7. Accessibility and safety

- WCAG 2.2 AA is required. Accessibility failures are security-relevant only where they block access to controls; they are tested anyway.
- Input validation on every endpoint. Output encoding in email templates.
- CSP-safe SPFx code: no inline scripts and no `eval`.

## 8. Items to verify before go-live

- [ ] Anonymous links disabled at site level (verify in dev).
- [ ] Exchange application access policy applied and tested for the shared mailbox only.
- [ ] Key Vault access by managed identity only; no key-based access.
- [ ] Webhook renewal and delta-token storage tested under failure.
- [ ] Purview audit ingestion confirmed (licence and retention).
- [ ] Password from the workbook rotated and checked.
