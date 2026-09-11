# delete-old-deploys.ps1  (JRT-35, 11 Sep 2026)
# ---------------------------------------------------------------------------
# Deletes old Netlify deploys of the adhjrt site. Every old deploy keeps its own
# address (<deploy-id>--adhquins-jrt.netlify.app) and runs ITS old code against
# production's live variables and data - including a manager-signup from before
# the rate limit. Deleting the deploy is what takes that address down.
#
# SAFE BY DEFAULT: with no switch it only LISTS what it would keep and delete.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/delete-old-deploys.ps1           (dry run)
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/delete-old-deploys.ps1 -Delete   (asks, then deletes)
#
# KEEPS, always:
#   - the deploy that is live on adhjrt.com right now (read from Netlify, not typed in)
#   - the newest $KeepProduction production deploys, so one-click rollback still works
#   - the newest dev branch deploy, which is what dev--adhquins-jrt.netlify.app serves
#   - anything not finished (building, queued, new) - a build in flight is never touched
# DELETES everything else that is 'ready' or 'error', OLDEST FIRST.
#
# STOPS before deleting anything if: the live deploy cannot be found, it is not
# in the keep list, the newest dev deploy cannot be found, or you do not type the
# exact number of deploys. Deleting is permanent. Uses the Netlify CLI's own
# sign-in on this PC; no token is read, printed or passed by this script.

param([switch]$Delete, [int]$KeepProduction = 5)

$ErrorActionPreference = 'Stop'
$SiteId = '8bb8cade-864f-416d-a4b8-eadda5f1997e'

# Windows PowerShell 5.1 strips double quotes inside arguments to programs;
# PowerShell 7 does not. Escape them only where they would be stripped.
function Json-Arg($obj) {
  $s = $obj | ConvertTo-Json -Compress
  if ($PSVersionTable.PSVersion.Major -lt 7) { $s = $s -replace '"', '\"' }
  return $s
}

function Invoke-NetlifyJson($op, $data) {
  $raw = & netlify api $op --data (Json-Arg $data) 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "The Netlify CLI refused '$op':`n$raw" }
  try { return ($raw | ConvertFrom-Json) } catch { throw "'$op' did not come back as JSON." }
}

function Get-AllDeploys {
  for ($page = 1; $page -le 40; $page++) {
    $list = Invoke-NetlifyJson 'listSiteDeploys' @{ site_id = $SiteId; per_page = 100; page = $page }
    $n = 0
    # Emit each deploy on its own: Windows PowerShell 5.1 hands back a JSON
    # array as ONE object (the bug the Compare script's first dry run found).
    foreach ($d in $list) { $n++; $d }
    if ($n -lt 100) { break }
  }
}

function Show-Row($d, $why) {
  Write-Host ("  {0}  {1,-15} {2,-30} {3}  {4}" -f $d.id, $d.context, $d.branch, ([string]$d.created_at).Substring(0, 10), $why)
}

Write-Host ''
Write-Host "Reading the live deploy and listing every deploy for site $SiteId ..." -ForegroundColor Cyan
# The site record can carry settings; it is parsed in memory and only the
# published deploy id is used. Nothing from it is printed.
$site = Invoke-NetlifyJson 'getSite' @{ site_id = $SiteId }
$liveId = [string]$site.published_deploy.id
$all = @(Get-AllDeploys)
Write-Host ("Deploys listed: {0}" -f $all.Count)

# ---- the keep list ---------------------------------------------------------
if (-not $liveId) { Write-Host 'STOP: could not read the live deploy id. Nothing was deleted.' -ForegroundColor Red; exit 1 }
$live = @($all | Where-Object { $_.id -eq $liveId })
if ($live.Count -ne 1) { Write-Host "STOP: the live deploy $liveId is not in the list. Nothing was deleted." -ForegroundColor Red; exit 1 }

$keep = @{}
$keep[$liveId] = 'LIVE on adhjrt.com'
$prod = @($all | Where-Object { $_.context -eq 'production' -and $_.state -eq 'ready' } | Sort-Object { [datetime]$_.created_at } -Descending)
foreach ($d in ($prod | Select-Object -First $KeepProduction)) { if (-not $keep.ContainsKey($d.id)) { $keep[$d.id] = 'rollback target' } }
$devNewest = @($all | Where-Object { $_.branch -eq 'dev' -and $_.context -eq 'branch-deploy' -and $_.state -eq 'ready' } | Sort-Object { [datetime]$_.created_at } -Descending | Select-Object -First 1)
if ($devNewest.Count -ne 1) { Write-Host 'STOP: could not find the newest dev deploy (what dev-- serves). Nothing was deleted.' -ForegroundColor Red; exit 1 }
if (-not $keep.ContainsKey($devNewest[0].id)) { $keep[$devNewest[0].id] = 'what dev-- serves' }
foreach ($d in ($all | Where-Object { $_.state -ne 'ready' -and $_.state -ne 'error' })) { if (-not $keep.ContainsKey($d.id)) { $keep[$d.id] = "not finished ($($d.state))" } }
if (-not $keep.ContainsKey($liveId)) { Write-Host 'STOP: the live deploy fell out of the keep list. Nothing was deleted.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host ("KEEP ({0}):" -f $keep.Count) -ForegroundColor Green
foreach ($d in ($all | Where-Object { $keep.ContainsKey($_.id) } | Sort-Object { [datetime]$_.created_at } -Descending)) { Show-Row $d $keep[$d.id] }

# ---- the delete list, oldest first ------------------------------------------
$plan = @($all | Where-Object { -not $keep.ContainsKey($_.id) -and ($_.state -eq 'ready' -or $_.state -eq 'error') } | Sort-Object { [datetime]$_.created_at })
if ($plan | Where-Object { $_.id -eq $liveId }) { Write-Host 'STOP: the live deploy is in the delete list. Nothing was deleted.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host ("DELETE ({0}), oldest first. By type:" -f $plan.Count) -ForegroundColor Yellow
$plan | Group-Object context, state | Sort-Object Name | ForEach-Object { Write-Host ("  {0,-28} {1}" -f $_.Name, $_.Count) }
Write-Host '  first three:'; $plan | Select-Object -First 3 | ForEach-Object { Show-Row $_ '' }
Write-Host '  last three:';  $plan | Select-Object -Last 3  | ForEach-Object { Show-Row $_ '' }

if (-not $Delete) {
  Write-Host ''
  Write-Host 'DRY RUN - nothing was deleted. Run again with -Delete to delete these.' -ForegroundColor Green
  exit 0
}

Write-Host ''
Write-Host ("This PERMANENTLY deletes {0} deploys. It takes a few minutes." -f $plan.Count) -ForegroundColor Red
$answer = Read-Host ("Type the number of deploys ({0}) to go ahead, or anything else to stop" -f $plan.Count)
if ($answer -ne [string]$plan.Count) { Write-Host 'Stopped. Nothing was deleted.' -ForegroundColor Green; exit 0 }

# ---- delete, oldest first, gently -------------------------------------------
$ok = 0; $failed = @(); $n = 0
foreach ($d in $plan) {
  $n++
  $done = $false
  for ($try = 1; $try -le 4 -and -not $done; $try++) {
    $out = & netlify api deleteSiteDeploy --data (Json-Arg @{ site_id = $SiteId; deploy_id = $d.id }) 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) { $done = $true }
    elseif ($out -match '429|rate limit|Too Many') { Start-Sleep -Seconds (15 * $try) }
    else { break }
  }
  if ($done) { $ok++; if ($n % 25 -eq 0 -or $n -eq $plan.Count) { Write-Host ("  {0}/{1} deleted so far" -f $n, $plan.Count) } }
  else { $failed += $d.id; Write-Host ("  {0}/{1}  FAILED  {2}  {3}" -f $n, $plan.Count, $d.id, $out.Trim()) -ForegroundColor Red }
  Start-Sleep -Milliseconds 250
}

# ---- what is left, measured again -------------------------------------------
Write-Host ''
$left = @(Get-AllDeploys)
$liveNow = [string](Invoke-NetlifyJson 'getSite' @{ site_id = $SiteId }).published_deploy.id
Write-Host ("Deleted {0} of {1}. Failed: {2}. Deploys left: {3}. Live deploy still {4}: {5}." -f $ok, $plan.Count, $failed.Count, $left.Count, $liveId, ($liveNow -eq $liveId)) -ForegroundColor Cyan
if ($failed.Count -gt 0 -or $liveNow -ne $liveId) { exit 1 }
Write-Host 'Done. Tell Claude, so it can probe the old addresses.' -ForegroundColor Green
exit 0
