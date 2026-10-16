[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://academian1\.sharepoint\.com/sites/sns/?$')]
    [string]$SiteUrl,
    [switch]$RemoveEmptyResources,
    [switch]$RemovePage
)

#Requires -Modules PnP.PowerShell
$ErrorActionPreference = 'Stop'
$expectedSite = 'https://academian1.sharepoint.com/sites/sns'
if ($SiteUrl.TrimEnd('/') -ne $expectedSite) {
    throw "Refusing rollback outside the verified SnS site."
}
$connectedUrl = (Get-PnPWeb -Includes Url).Url.TrimEnd('/')
if ($connectedUrl -ne $expectedSite) {
    throw "The active PnP connection targets '$connectedUrl', not '$expectedSite'."
}

if ($RemovePage) {
    $pageName = 'marketingcollateral.aspx'
    $page = Get-PnPPage -Identity $pageName -ErrorAction SilentlyContinue
    if ($page) {
        $components = @(Get-PnPPageComponent -Page $pageName)
        $solutionComponents = @($components | Where-Object { ([string]$_.WebPartId).Trim('{}') -eq '8bbf1130-c59b-4e29-987f-11dd86005778' })
        if ($components.Count -ne 1 -or $solutionComponents.Count -ne 1) {
            throw 'Page contains content beyond the solution web part. Refusing to delete user content.'
        }
        if ($PSCmdlet.ShouldProcess($pageName, 'Remove the page after confirming it contains only the solution web part')) {
            Remove-PnPPage -Identity $pageName -Force
        }
    }
}

if ($RemoveEmptyResources) {
    $schema = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'schemas\lists.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($resource in @($schema.lists | Sort-Object { $_.title } -Descending)) {
        $list = Get-PnPList -Identity $resource.title -ErrorAction SilentlyContinue
        if (-not $list) { continue }
        if ($list.ItemCount -gt 0) {
            Write-Warning "Preserving '$($resource.title)' because it contains $($list.ItemCount) item(s). Export and review user data before any manual cleanup."
            continue
        }
        if ($PSCmdlet.ShouldProcess($resource.title, 'Remove this empty, namespaced solution resource')) {
            Remove-PnPList -Identity $resource.title -Force
        }
    }
}

Write-Output 'No user data, populated resources, or pages containing additional content were removed.'
