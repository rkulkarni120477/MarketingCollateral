[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://academian1\.sharepoint\.com/sites/sns/?$')]
    [string]$SiteUrl
)

#Requires -Modules PnP.PowerShell
$ErrorActionPreference = 'Stop'
$expectedSite = 'https://academian1.sharepoint.com/sites/sns'
if ($SiteUrl.TrimEnd('/') -ne $expectedSite) {
    throw "Refusing to inspect a site other than $expectedSite."
}
$connectedUrl = (Get-PnPWeb -Includes Url).Url.TrimEnd('/')
if ($connectedUrl -ne $expectedSite) {
    throw "The active PnP connection targets '$connectedUrl', not '$expectedSite'."
}

$schema = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'schemas\lists.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$results = foreach ($resource in $schema.lists) {
    $list = Get-PnPList -Identity $resource.title -ErrorAction SilentlyContinue
    if (-not $list) {
        [pscustomobject]@{ Resource = $resource.title; State = 'Missing'; Details = 'Not provisioned' }
        continue
    }
    $missing = @()
    $wrongType = @()
    foreach ($field in $resource.fields) {
        $actualField = Get-PnPField -List $resource.title -Identity ([string]$field[0]) -ErrorAction SilentlyContinue
        if (-not $actualField) {
            $missing += [string]$field[0]
        } elseif ($actualField.TypeAsString -ne [string]$field[1]) {
            $wrongType += [string]$field[0]
        }
    }
    Get-PnPProperty -ClientObject $list -Property HasUniqueRoleAssignments | Out-Null
    [pscustomobject]@{
        Resource = $resource.title
        State = if ($missing.Count -or $wrongType.Count -or -not $list.HasUniqueRoleAssignments) { 'Inspect' } else { 'Present' }
        Details = "Missing fields: $($missing -join ', '); wrong field types: $($wrongType -join ', '); UniquePermissions=$($list.HasUniqueRoleAssignments)"
    }
}
$results | Format-Table -AutoSize

$page = Get-PnPPage -Identity 'marketingcollateral.aspx' -ErrorAction SilentlyContinue
if ($page) {
    $components = @(Get-PnPPageComponent -Page 'marketingcollateral.aspx')
    [pscustomobject]@{
        Resource = 'marketingcollateral.aspx'
        State = if (@($components | Where-Object { ([string]$_.WebPartId).Trim('{}') -eq '8bbf1130-c59b-4e29-987f-11dd86005778' }).Count -eq 1) { 'Present' } else { 'Inspect' }
        Details = "Title=$($page.PageTitle); components=$($components.Count)"
    } | Format-List
} else {
    Write-Output 'marketingcollateral.aspx: Missing'
}
