#!/usr/bin/env node
/* tools/scan-personal-data.js
   ------------------------------------------------------------------------
   Scans every git-tracked text file for personal data BEFORE the docs cut
   (claude/decisions/2026-09-10-documentation-cut.md, step 1).

   RUN IT YOURSELF, ON YOUR PC. The names it checks against come from the
   registration sheets, which hold children's names — a Claude session must
   never read those, so the CSV is yours to download and the path is yours to
   pass. The tool prints FILE PATHS AND COUNTS ONLY. It never prints a matched
   string, a name, an address or a number, so its output is safe to paste
   into a chat.

   In PowerShell, from the repo root:
       node tools/scan-personal-data.js --names C:\Users\Jay\Downloads\players.csv --control "Marcus Reed"

   Three probes, each with a CONTROL so an empty result means "absent", not
   "the probe is broken" (CLAUDE.md rule 8):

     emails   every address, reported by DOMAIN with a count. Fixtures use
              example.com / .test / .invalid; the tournament's own domain is
              expected. Anything else is a finding.
              control: the tournament's own domain must appear at least once.

     phones   UAE mobile shapes (9715xxxxxxxx, +971 5x ...). Each distinct
              number is classed SYNTHETIC (1234567, repeated digits, the known
              rehearsal number) or UNEXPLAINED, and files carrying UNEXPLAINED
              ones are listed.
              control: the known rehearsal number 971500000000 must be found.

     names    every "First Last" string in the CSV (any cell holding two or
              more words of letters) is searched for, whole-word,
              case-insensitive, in every tracked text file. Files with a hit
              are listed with a count. Single first names are NOT searched —
              too many false hits ("Jay", "Tom") to be useful.
              control: --control "<an invented name known to be in the repo>"
              must be found, or the name probe reports itself invalid.

   No dependencies. Reads the tracked file list from `git ls-files`.
   ------------------------------------------------------------------------ */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OWN_DOMAIN = 'adhjrt.com';
const FIXTURE_DOMAINS = /(^|\.)(example\.(com|org|net|test)|test|invalid|localhost)$/i;
const REHEARSAL_PHONE = '971500000000';
const SYNTHETIC_DIGITS = /1234567|0000000|1111111|9999999|(\d)\1{5}/;
const TEXT_EXT = /\.(js|json|md|html|toml|txt|xml|ps1|py|css|webmanifest|yml|yaml|csv)$/i;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function repoRoot() {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
}

function trackedTextFiles(root) {
  const out = execSync('git ls-files -z', { cwd: root, encoding: 'utf8' });
  return out.split('\0').filter((f) => f && TEXT_EXT.test(f) && !f.startsWith('graft/'));
}

/* Names from the CSV: every cell with two or more words made only of letters
   (apostrophes and hyphens allowed). The CSV layout does not matter — no
   column is assumed. Duplicates collapse. */
function namesFromCsv(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const names = new Set();
  for (const line of text.split(/\r?\n/)) {
    for (let cell of line.split(',')) {
      cell = cell.replace(/^"|"$/g, '').trim();
      if (/^[A-Za-z][A-Za-z'\-]+(\s+[A-Za-z][A-Za-z'\-]+)+$/.test(cell) && cell.length >= 5) {
        names.add(cell.toLowerCase().replace(/\s+/g, ' '));
      }
    }
  }
  return [...names];
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function main() {
  const root = repoRoot();
  const files = trackedTextFiles(root);
  const csv = arg('--names');
  const control = (arg('--control') || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const domains = new Map();          // domain -> count
  const phoneFiles = new Map();       // file -> Set of distinct numbers (digits only)
  const phoneClass = new Map();       // digits -> 'synthetic' | 'unexplained'
  const nameHits = new Map();         // file -> count
  let controlNameHit = 0;

  const names = csv ? namesFromCsv(csv) : [];
  const nameRes = names.map((n) => new RegExp('\\b' + escapeRe(n).replace(/ /g, '\\s+') + '\\b', 'gi'));
  const controlRe = control ? new RegExp('\\b' + escapeRe(control).replace(/ /g, '\\s+') + '\\b', 'gi') : null;

  for (const rel of files) {
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }

    for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)) {
      const d = m[1].toLowerCase();
      domains.set(d, (domains.get(d) || 0) + 1);
    }

    for (const m of text.matchAll(/\b9715\d{8}\b|\+971\s?5\d[\d ]{6,9}/g)) {
      const digits = m[0].replace(/\D/g, '');
      const cls = digits === REHEARSAL_PHONE || SYNTHETIC_DIGITS.test(digits) ? 'synthetic' : 'unexplained';
      phoneClass.set(digits, cls);
      if (!phoneFiles.has(rel)) phoneFiles.set(rel, new Set());
      phoneFiles.get(rel).add(digits);
    }

    let count = 0;
    for (const re of nameRes) { const hits = text.match(re); if (hits) count += hits.length; }
    if (count) nameHits.set(rel, count);
    if (controlRe) { const hits = text.match(controlRe); if (hits) controlNameHit += hits.length; }
  }

  /* ---------- report: paths and counts only ---------- */
  console.log(`scanned ${files.length} tracked text files under ${root}\n`);

  console.log('EMAILS by domain');
  let ownSeen = false;
  for (const [d, n] of [...domains.entries()].sort((a, b) => b[1] - a[1])) {
    const tag = d === OWN_DOMAIN ? 'own domain' : FIXTURE_DOMAINS.test(d) ? 'fixture domain' : 'FINDING';
    if (d === OWN_DOMAIN) ownSeen = true;
    console.log(`  ${String(n).padStart(4)}  ${d}  [${tag}]`);
  }
  console.log(`  control: own domain ${ownSeen ? 'found — probe valid' : 'NOT FOUND — probe INVALID'}\n`);

  console.log('PHONES');
  const synthetic = [...phoneClass.values()].filter((c) => c === 'synthetic').length;
  const unexplained = [...phoneClass.values()].filter((c) => c === 'unexplained').length;
  console.log(`  distinct numbers: ${phoneClass.size} (${synthetic} synthetic, ${unexplained} unexplained)`);
  for (const [f, set] of phoneFiles) {
    const u = [...set].filter((d) => phoneClass.get(d) === 'unexplained').length;
    if (u) console.log(`  ${String(u).padStart(4)} unexplained in ${f}`);
  }
  const rehearsalSeen = phoneClass.has(REHEARSAL_PHONE);
  console.log(`  control: rehearsal number ${rehearsalSeen ? 'found — probe valid' : 'NOT FOUND — probe INVALID'}\n`);

  console.log('NAMES');
  if (!csv) {
    console.log('  skipped — pass --names <csv> to run it');
  } else {
    console.log(`  ${names.length} distinct full names read from the CSV (not shown)`);
    if (!control) {
      console.log('  no --control given — the probe cannot prove it works; result NOT trusted');
    } else {
      console.log(`  control name: ${controlNameHit ? `found ${controlNameHit}x — probe valid` : 'NOT FOUND — probe INVALID'}`);
    }
    if (nameHits.size === 0) console.log('  no tracked file contains a name from the CSV');
    for (const [f, n] of [...nameHits.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)} hit(s) in ${f}   <-- FINDING: stop and tell Jay, do not fix quietly`);
    }
  }
}

main();
