# tests/runall.ps1
# ---------------------------------------------------------------------------
# THIS IS THE SUITE. The files named below, plus the fault-injection run at the
# bottom, are the authority for this repo. A green run here is a green run.
#
# The old C:\Users\jayjm\adhjrt-sim folder on jay-pc is NOT a missing half, and
# does NOT need running alongside this. Triaged 2 Aug 2026: seven of its
# thirteen files are stale or test subjects that have since been deleted, and
# the rest overlap what is here. Optional extra signal at best. Detail in
# tests/README.md and in CLAUDE.md's Tests section.
#
#   powershell tests/runall.ps1              everything
#   powershell tests/runall.ps1 -NoProve     skip the slow fault-injection run
#
# Exits non-zero if anything fails, so it can gate a commit.

# WARNING: 'Continue', NOT 'Stop', AND THAT IS A BUG FIX (2 Aug 2026).
# With 'Stop', PowerShell treats ANYTHING node writes to stderr as a
# terminating error - including a harmless Node warning. test-knockout-
# brackets.js emits MODULE_TYPELESS_PACKAGE_JSON, so this script had been
# aborting there every run: the file after it never ran, and neither did the
# fault-injection pass at the bottom. It printed no failure and exited 1, which
# reads like one test failing rather than a third of the run not happening.
# Nothing is lost by relaxing it - every pass/fail decision below is made from
# $LASTEXITCODE, not from the error preference.
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = @()

# THE EXPLICIT LIST. Add new test files here BY HAND - a file that is not named
# here never runs again, and nothing will tell you.
$tests = @(
  'test-registration.js',
  'test-registration-panel.js',
  'test-venue-map.js',
  'test-venue-splits.js',
  'test-session-permissions.js',
  'test-session-revocation.js',
  'test-results-storage.js',
  'test-agegroups.js',
  'test-intake.js',
  'test-functions-load.js',
  'test-accounts.js',
  'test-unified-login.js',
  'test-signup-ratelimit.js',
  'test-login-ratelimit.js',
  'test-my-account.js',
  'test-session-migration.js',
  'test-signin-page.js',
  'test-organizer-grouping.js',
  'test-organizer-tournament.js',
  'test-organizer-clubs.js',
  'test-documents.js',
  'test-email.js',
  'test-google-auth.js',
  'test-google-auth-behaviour.js',
  'test-fixtures-results-sync.js',
  'test-simulate-tournament.js',
  'test-team-logos.js',
  'test-fixtures-logos.js',
  'test-organizer-manager-link.js',
  'test-manager-dc.js',
  'test-manager-dc-score-sheet.js',
  'test-manager-dc-draw.js',
  # Managers and organisers can see an unpublished draw (8 Aug 2026) - spec
  # claude/specs/spec-draft-visibility-aug-2026.md. A NEW TEST FILE DOES NOT
  # JOIN THE SUITE BY ITSELF; this line is the whole registration.
  'test-draft-visibility.js',
  'test-knockout-brackets.js',
  'test-simulate-spirit-award.js',
  'test-scores-public.js',
  'test-sponsors.js',
  'test-light-mode.js',
  'test-design-polish.js',
  'test-back-office-links.js',
  'test-head-metadata.js',
  'test-image-weight.js',
  'test-accessibility.js',
  'test-validate-not-coerce.js',
  'test-scoring-model.js',
  'test-homepage-dates.js',
  'test-about-board.js',
  'test-doc-claims.js',
  'test-age-group-picker.js',
  # /app stopped polling the API from a backgrounded phone (11 Aug 2026).
  # A NEW TEST FILE DOES NOT JOIN THE SUITE BY ITSELF; this line is the whole
  # registration - same note as test-draft-visibility.js above.
  'test-app-polling.js',
  # Being signed out by the server (11 Aug 2026) - spec
  # claude/specs/spec-session-refusal-aug-2026.md. Same note as above: this
  # line is the registration.
  'test-session-refusal.js',
  # The Club invite link box (11 Aug 2026) - spec
  # claude/specs/spec-club-invite-link.md. A NEW TEST FILE DOES NOT JOIN THE
  # SUITE BY ITSELF; this line is the whole registration.
  'test-club-link.js'
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
exit 0
