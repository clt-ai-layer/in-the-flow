# Manual sync helper script for InTheFlow
param(
    [switch]$Force
)

$Url = "http://localhost:8000/api/settings/sync-planning"
if ($Force) {
    $Url += "?force=true"
    Write-Host "Triggering forced planning sync..."
} else {
    $Url += "?force=false"
    Write-Host "Triggering planning sync (will skip if file hash matches)..."
}

try {
    $Result = Invoke-RestMethod -Uri $Url -Method Post
    Write-Host "`nSync Response:" -ForegroundColor Green
    $Result | ConvertTo-Json -Depth 4
} catch {
    Write-Error "Request failed: $_"
}
