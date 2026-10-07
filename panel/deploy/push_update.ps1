<#
Sends a new build of the panel to the server and restarts it.
Copies the code (server.py, accounts.py, web) and the data (activity.db, dashboard.json).
The reviewers' decisions (review.db) and accounts (users.db) stay on the server and are never copied.

  powershell -ExecutionPolicy Bypass -File push_update.ps1 -Key C:\keys\panel.pem -Server ubuntu@<server address>
  powershell -ExecutionPolicy Bypass -File push_update.ps1 -Key C:\keys\panel.pem -Server ubuntu@<server address> -CodeOnly

<server address> is the server's public IP or a DNS name that points straight at it (SSH does not pass
through a load balancer or CDN).
#>
param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Server,
    [switch]$CodeOnly
)
$ErrorActionPreference = "Stop"
$panel = Split-Path -Parent $PSScriptRoot

function Run([string]$what) {
    if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" }
}

ssh -i $Key $Server "rm -rf /tmp/panel-update; mkdir -p /tmp/panel-update"
Run "Connecting to the server"

$files = @("$panel\server.py", "$panel\accounts.py", "$panel\requirements.txt")
if (-not $CodeOnly) { $files += @("$panel\data\activity.db", "$panel\data\dashboard.json") }
scp -i $Key $files "${Server}:/tmp/panel-update/"
Run "Copying files"
scp -i $Key -r "$panel\web" "${Server}:/tmp/panel-update/"
Run "Copying the web app"

ssh -i $Key $Server "sudo /usr/local/bin/fraud-panel-install-update"
Run "Installing on the server"
Write-Host "Panel updated on $Server"
