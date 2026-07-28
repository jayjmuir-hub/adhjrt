# tests/runall.ps1
# ---------------------------------------------------------------------------
# THIS IS NOT YET THE WHOLE SUITE. Thirteen more test files — 577 checks — are
# still in C:\Users\jayjm\adhjrt-sim on jay-pc and are not in version control.
# tests/README.md has the procedure for bringing them in, and the data check
# that has to happen first because this repo is public.
#
# Until that is done, run BOTH before trusting a change.
#
#   powershell tests/runall.ps1              everything
#   powershell tests/runall.ps1 -NoProve     skip the slow fault-injection run
#
# Exits non-zero if anything fails, so it can gate a commit.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = @()

# THE EXPLICIT LIST. Add new test files here BY HAND — a file that is not named
# here never runs again, and nothing will tell you.
$tests = @(
  'test-registration.js',
  'test-registration-panel.js',
  'test-venue-map.js',
  'test-venue-splits.js',
  'test-agegroups.js',
  'test-intake.js',
  'test-functions-load.js',
  'test-accounts.js'
)

Write-Host ''
Write-Host '=== adhjrt tests ===' -ForegroundColor Cyan
Write-Host ''

foreach ($t in $tests) {
  $path = Join-Path $here $t
  if (-not (Test-Path $path)) {
    Write-Host "MISSING  $t" -ForegroundColor Red
    $failed += $t
    continue
  }
  Write-Host "--- $t" -ForegroundColor Yellow
  & node $path
  if ($LASTEXITCODE -ne 0) { $failed += $t }
  Write-Host ''
}

# Separate from the list above because it is slow (a node process per fault) and
# because it is a check on the TESTS, not on the site.
if (-not ($args -contains '-NoProve')) {
  Write-Host '--- _prove-registration.js  (breaking the code on purpose)' -ForegroundColor Yellow
  & node (Join-Path $here '_prove-registration.js')
  if ($LASTEXITCODE -ne 0) { $failed += '_prove-registration.js' }
  Write-Host ''
}

if ($failed.Count -gt 0) {
  Write-Host ("FAILED: " + ($failed -join ', ')) -ForegroundColor Red
  exit 1
}

Write-Host 'All green.' -ForegroundColor Green
Write-Host 'Reminder: thirteen more test files are still on jay-pc only — see tests/README.md.' -ForegroundColor DarkYellow
exit 0
