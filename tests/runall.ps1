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

# ⚠️ 'Continue', NOT 'Stop', AND THAT IS A BUG FIX (2 Aug 2026).
# With 'Stop', PowerShell treats ANYTHING node writes to stderr as a
# terminating error — including a harmless Node warning. test-knockout-
# brackets.js emits MODULE_TYPELESS_PACKAGE_JSON, so this script had been
# aborting there every run: the file after it never ran, and neither did the
# fault-injection pass at the bottom. It printed no failure and exited 1, which
# reads like one test failing rather than a third of the run not happening.
# Nothing is lost by relaxing it — every pass/fail decision below is made from
# $LASTEXITCODE, not from the error preference.
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = @()

# THE EXPLICIT LIST. Add new test files here BY HAND — a file that is not named
# here never runs again, and nothing will tell you.
$tests = @(
  'test-registration.js',
  'test-registration-panel.js',
  'test-venue-map.js',
  'test-venue-splits.js',
  'test-session-permissions.js',
  'test-agegroups.js',
  'test-intake.js',
  'test-functions-load.js',
  'test-accounts.js',
  'test-organizer-grouping.js',
  'test-organizer-tournament.js',
  'test-email.js',
  'test-google-auth.js',
  'test-fixtures-results-sync.js',
  'test-simulate-tournament.js',
  'test-team-logos.js',
  'test-fixtures-logos.js',
  'test-organizer-manager-link.js',
  'test-manager-dc.js',
  'test-manager-dc-score-sheet.js',
  'test-manager-dc-draw.js',
  'test-knockout-brackets.js',
  'test-simulate-spirit-award.js',
  'test-scores-public.js',
  'test-sponsors.js',
  'test-back-office-links.js'
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
