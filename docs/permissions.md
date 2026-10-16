# Permissions model

Written for: the site owner and whoever approves permission changes on the SnS site. Nothing here has been applied or tenant-tested. The provisioning script requires three distinct existing group names; their identity and membership must be verified before any change.

## Capabilities

| Capability | Can do | Cannot do |
| --- | --- | --- |
| **Reader** | Read/filter/search the reader-facing Published catalogue projection, approved statistics and client names; open referenced files only when SharePoint separately grants access | Read private catalogue, protected notes, legacy evidence, review tasks, or edit data |
| **Maintainer** | Read/edit private catalogue metadata, manage review tasks, edit statistics/components and client metadata; read the reader projection | Read protected notes or legacy evidence unless also owner; change permissions or site settings |
| **Owner** | Everything a maintainer can do, plus read protected notes and legacy evidence, manage restricted stores and approve statistic decisions | Change tenant or app-catalog settings (tenant-admin actions) |

This is the intended capability model, not a claim that every workflow is implemented. File upload/replace, explicit file preview/download, review-task creation/resolution, and full statistics approval workflows remain incomplete.

## Mapping to site groups (to verify)

| Capability | SharePoint group | Status |
| --- | --- | --- |
| Reader | Verified existing reader group | **Required input; not verified** |
| Maintainer | Verified existing maintainer group | **Required input; not verified** |
| Owner | Verified existing owner group | **Required input; not verified** |

The provisioning script does not create groups or add people, and it rejects duplicate group names. Email distribution lists are not suitable security principals.

Site ownership does not grant tenant-admin or app-catalog rights. Deploying the package to the tenant app catalog needs a separate check (see `docs/deployment.md`).

## Where each rule is enforced

Visibility rules must hold in SharePoint storage and APIs. Hidden buttons are not a control.

| Data | Store | How it is protected |
| --- | --- | --- |
| Private catalogue and all lifecycle states | `MC_Catalogue` list | Maintainer/Owner only; list API does not expose drafts to readers |
| Published reader projection | `MC_PublicCatalogue` list | Reader read; maintained from Published records in the private catalogue. Cross-list synchronization is not atomic and is not tenant-tested. |
| Protected notes (review comments, BDM notes, editorial notes, historical FTE notes) | `MC_ProtectedNotes` | Unique permissions: owner only. Not returned by readers' queries, search or exports. |
| Legacy evidence (hidden rows, logo instructions, legacy links, 550 claims) | `MC_LegacyEvidence` | Unique permissions: owner only. |
| Review tasks | `MC_ReviewTasks` | Maintainer/Owner only; web-part task creation/resolution is incomplete. |
| Statistics | `MC_Statistics`, `MC_StatComponents` | Readers read; maintainers edit components and approval metadata. The total is calculated and not editable. |
| Clients and logos | `MC_Clients`, `MC_Logos` | Readers read; maintainers edit. |
| Source files | `MC_SourceFiles` library | Standard Reader/Maintainer/Owner ACL; source file access may expose content independently of catalogue visibility. |
| Published renditions | `MC_Renditions` library | Standard Reader/Maintainer/Owner ACL; no tenant file-access test has run. |
| Logos | `MC_Logos` library | Standard Reader/Maintainer/Owner ACL. |
| Confidential files | `MC_Confidential` library with unique permissions | Maintainer/Owner only. |

## Concurrency and history

- Records carry a version or ETag. An update that does not match the current version is refused and shown to the user as a conflict.
- File replacement keeps the SharePoint version history; the source version label is stored separately.
- Archive sets a status and keeps the record. Restore clears it. Nothing is deleted by these actions.

## Tests required (not yet run on a tenant)

Run these with a reader account, a maintainer account and an owner account on the live site:

1. Reader cannot read `MC_Catalogue` or any Draft, In Review or Archived record through REST or Graph; Reader can read only Published items in `MC_PublicCatalogue`.
2. Reader cannot read `MC_ProtectedNotes` or `MC_LegacyEvidence` by any route.
3. Maintainer can edit a statistic component, and the total updates.
4. Two maintainers editing the same record: the second save is refused, not overwritten.
5. Reader cannot open a confidential file by direct link.
