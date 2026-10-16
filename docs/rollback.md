# Rollback

Written for: the site owner and whoever runs a rollback. Status: **nothing has been deployed, so nothing needs rolling back yet.** `provisioning/Rollback-MarketingCollateral.ps1` is a conservative, opt-in cleanup script; it has not been run against the tenant.

## Principles

- Roll back only the namespaced resources in `provisioning/schemas/lists.json`.
- The script does not identify creation ownership by a deployment marker. Do not invoke it unless the owner has independently verified that each targeted resource was created by this solution.
- The script preserves populated lists/libraries and refuses to delete a page unless it contains exactly one solution web part and no other components.
- `-WhatIf`/`ShouldProcess` previews destructive actions. Review the preview and obtain owner approval before a real run.

## What is undone, in order

1. **Page.** With `-RemovePage`, remove `marketingcollateral.aspx` only if it contains exactly the solution web part and no other page components. The script will not remove just the web part from a mixed-content page.
2. **Lists and libraries.** With `-RemoveEmptyResources`, remove only empty resources named in the schema. Populated resources are retained and reported; no imported items are deleted.
3. **Package.** The script does not retract the app package; that remains a separate tenant/app-catalog owner action.

## What is never touched

- The SnS home page (`CollabHome.aspx`) and its web parts.
- Any other page, list, library, group or site permission. The rollback script does not restore a permission snapshot; capture and review permissions separately before provisioning.
- `MarketingCollateral.xlsx` and the local source files.
- Files in `MC_SourceFiles` or `MC_Confidential` that a person uploaded, unless the owner names them.

## Checks after rollback

- The SnS home page still loads and its navigation is unchanged.
- Site permissions match the pre-deployment export.
- No solution resource was removed without owner approval; populated resources and all data remain intact unless separately reviewed and handled by an approved process.

## Local rollback

The local project has no deployed state. Regenerate ignored migration outputs using the documented importer workflow. Do not delete the workbook.
