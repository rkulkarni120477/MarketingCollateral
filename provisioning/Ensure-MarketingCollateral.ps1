[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://academian1\.sharepoint\.com/sites/sns/?$')]
    [string]$SiteUrl,
    [Parameter(Mandatory = $true)]
    [string]$ReaderGroup,
    [Parameter(Mandatory = $true)]
    [string]$MaintainerGroup,
    [Parameter(Mandatory = $true)]
    [string]$OwnerGroup,
    [switch]$CreatePage,
    [string]$WebPartId = '8bbf1130-c59b-4e29-987f-11dd86005778'
)

#Requires -Modules PnP.PowerShell
$ErrorActionPreference = 'Stop'
$schemaPath = Join-Path $PSScriptRoot 'schemas\lists.json'
$schema = Get-Content -LiteralPath $schemaPath -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedSite = 'https://academian1.sharepoint.com/sites/sns'
$actualSite = $SiteUrl.TrimEnd('/')
if ($actualSite -ne $expectedSite) {
    throw "Refusing to provision outside the verified SnS site: $SiteUrl"
}

if (-not (Get-PnPContext -ErrorAction SilentlyContinue)) {
    throw 'Connect to the SnS site with Connect-PnPOnline before running this script.'
}
$connectedUrl = (Get-PnPWeb -Includes Url).Url.TrimEnd('/')
if ($connectedUrl -ne $expectedSite) {
    throw "The active PnP connection targets '$connectedUrl', not '$expectedSite'."
}

$groups = @{}
foreach ($groupName in @($ReaderGroup, $MaintainerGroup, $OwnerGroup)) {
    $group = Get-PnPGroup -Identity $groupName -ErrorAction Stop
    $groups[$groupName] = $group
}
if ($ReaderGroup -eq $MaintainerGroup -or $ReaderGroup -eq $OwnerGroup -or $MaintainerGroup -eq $OwnerGroup) {
    throw 'Reader, maintainer, and owner groups must be distinct verified SharePoint groups.'
}

function Get-ExpectedRoleGroups([string]$Sensitivity) {
    switch ($Sensitivity) {
        'standard' { return @(@{ Name = $ReaderGroup; Role = 'Read' }, @{ Name = $MaintainerGroup; Role = 'Contribute' }, @{ Name = $OwnerGroup; Role = 'Full Control' }) }
        'maintainer' { return @(@{ Name = $MaintainerGroup; Role = 'Contribute' }, @{ Name = $OwnerGroup; Role = 'Full Control' }) }
        'restricted' { return @(@{ Name = $OwnerGroup; Role = 'Full Control' }) }
        'owner' { return @(@{ Name = $OwnerGroup; Role = 'Full Control' }) }
        'confidential' { return @(@{ Name = $MaintainerGroup; Role = 'Contribute' }, @{ Name = $OwnerGroup; Role = 'Full Control' }) }
        default { throw "Unknown resource sensitivity '$Sensitivity'." }
    }
}

$managedDescription = 'Managed by the SnS Marketing Collateral solution.'
foreach ($resource in $schema.lists) {
    $existing = Get-PnPList -Identity $resource.title -ErrorAction SilentlyContinue
    if ($existing) {
        $actualTemplate = [string]$existing.BaseTemplate
        $expectedTemplate = if ($resource.template -eq 'DocumentLibrary') { '101' } else { '100' }
        if ($actualTemplate -ne $expectedTemplate) {
            throw "Existing resource '$($resource.title)' has template $actualTemplate; expected $expectedTemplate. No changes made."
        }
        if ($existing.Description -ne $managedDescription) {
            throw "Existing resource '$($resource.title)' is not marked as solution-managed. Inspect it manually; no changes made."
        }
        $list = $existing
        Get-PnPProperty -ClientObject $list -Property HasUniqueRoleAssignments | Out-Null
        if (-not $list.HasUniqueRoleAssignments) {
            throw "Existing solution resource '$($resource.title)' inherits permissions. Resolve and review access manually before rerunning."
        }
    } else {
        $template = if ($resource.template -eq 'DocumentLibrary') { 'DocumentLibrary' } else { 'GenericList' }
        if (-not $PSCmdlet.ShouldProcess($resource.title, "Create namespaced SharePoint $template and secure it")) { continue }
        $list = New-PnPList -Title $resource.title -Template $template
        Set-PnPList -Identity $resource.title -Description $managedDescription
    }

    foreach ($field in $resource.fields) {
        $fieldName = [string]$field[0]
        $fieldType = [string]$field[1]
        $choices = $schema.choices.$fieldName
        $existingField = Get-PnPField -List $resource.title -Identity $fieldName -ErrorAction SilentlyContinue
        if ($existingField) {
            if ($existingField.TypeAsString -ne $fieldType) {
                throw "Field '$fieldName' on '$($resource.title)' has type '$($existingField.TypeAsString)', expected '$fieldType'."
            }
            continue
        }
        if (-not $PSCmdlet.ShouldProcess("$($resource.title).$fieldName", "Create field of type $fieldType")) { continue }
        if ($fieldType -eq 'Choice' -and $choices) {
            Add-PnPField -List $resource.title -DisplayName $fieldName -InternalName $fieldName -Type Choice -Choices $choices -AddToDefaultView:$false | Out-Null
        } else {
            Add-PnPField -List $resource.title -DisplayName $fieldName -InternalName $fieldName -Type $fieldType -AddToDefaultView:$false | Out-Null
        }
    }

    Get-PnPProperty -ClientObject $list -Property HasUniqueRoleAssignments | Out-Null
    if (-not $list.HasUniqueRoleAssignments) {
        if ($PSCmdlet.ShouldProcess($resource.title, 'Break permission inheritance and remove inherited assignments')) {
            Set-PnPList -Identity $resource.title -BreakRoleInheritance -CopyRoleAssignments:$false -ClearSubscopes
        }
    }
    foreach ($assignment in (Get-ExpectedRoleGroups $resource.sensitivity)) {
        if ($PSCmdlet.ShouldProcess($resource.title, "Grant $($assignment.Role) to $($assignment.Name)")) {
            Set-PnPListPermission -Identity $resource.title -Group $assignment.Name -AddRole $assignment.Role
        }
    }
}

if ($WhatIfPreference) {
    Write-Host 'WhatIf completed. No resources, settings, permissions, or pages were changed.'
    return
}

$stableIdLists = @('MC_Catalogue', 'MC_PublicCatalogue')
foreach ($listName in $stableIdLists) {
    $stableIdField = Get-PnPField -List $listName -Identity 'StableId' -ErrorAction Stop
    Get-PnPProperty -ClientObject $stableIdField -Property Indexed, EnforceUniqueValues | Out-Null
    if (-not $stableIdField.Indexed -or -not $stableIdField.EnforceUniqueValues) {
        if ($PSCmdlet.ShouldProcess("$listName.StableId", 'Enforce unique indexed stable identities')) {
            Set-PnPField -List $listName -Identity 'StableId' -Values @{ Indexed = $true; EnforceUniqueValues = $true }
        }
    }
}

$siteContent = Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'config\mappings\site-content.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$contentList = Get-PnPList -Identity 'MC_SiteContent' -ErrorAction Stop
$contentValues = @{
    Purpose = @{ TextValue = [string]$siteContent.Purpose }
    ShowcaseUrl = @{ UrlValue = [string]$siteContent.ShowcaseUrl }
    MaintainerGroup = @{ TextValue = $MaintainerGroup }
    OwnerGroup = @{ TextValue = $OwnerGroup }
}
foreach ($key in $contentValues.Keys) {
    $existingSetting = Get-PnPListItem -List 'MC_SiteContent' -PageSize 500 |
        Where-Object { $_.FieldValues.Key -eq $key } |
        Select-Object -First 1
    $expectedValue = if ($contentValues[$key].TextValue) { $contentValues[$key].TextValue } else { $contentValues[$key].UrlValue }
    if ($existingSetting) {
        $actualValue = if ($existingSetting.FieldValues.TextValue) { [string]$existingSetting.FieldValues.TextValue } else { [string]$existingSetting.FieldValues.UrlValue }
        if ($actualValue -ne $expectedValue) {
            throw "MC_SiteContent setting '$key' already exists with a different value. Review it manually; no changes made."
        }
        continue
    }
    if ($PSCmdlet.ShouldProcess("MC_SiteContent/$key", 'Add solution configuration')) {
        Add-PnPListItem -List 'MC_SiteContent' -Values (@{ Title = $key; Key = $key } + $contentValues[$key]) | Out-Null
    }
}

$pageName = 'marketingcollateral.aspx'
$page = Get-PnPPage -Identity $pageName -ErrorAction SilentlyContinue
if ($page) {
    $components = @(Get-PnPPageComponent -Page $pageName)
    $matchingComponents = @($components | Where-Object { ([string]$_.WebPartId).Trim('{}') -eq $WebPartId })
    if ($matchingComponents.Count -eq 1 -and $components.Count -eq 1) {
        Write-Host "The target page already contains only the Marketing Collateral web part; leaving it unchanged."
    } else {
        throw "The target page already exists and is not the exact solution-owned page. Inspect it manually; no page changes were made."
    }
} elseif ($CreatePage) {
    if (-not $PSCmdlet.ShouldProcess("$expectedSite/SitePages/$pageName", 'Create a modern page with the Marketing Collateral web part')) { return }
    $newPage = Add-PnPPage -Name $pageName -Title 'Marketing Collateral' -LayoutType Home
    Add-PnPPageSection -Page $newPage -SectionTemplate OneColumn -Order 1 | Out-Null
    Add-PnPPageWebPart -Page $newPage -Component $WebPartId -Section 1 -Column 1 | Out-Null
    Set-PnPPage -Identity $pageName -Publish
} else {
    Write-Warning "Page not created. Re-run with -CreatePage only after the SPFx package is installed and the page preview is approved."
}
