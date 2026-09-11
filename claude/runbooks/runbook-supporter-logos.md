# Supporter logos — add or replace one

Turns a sponsor's own artwork into a tile in the supporters grid.
`tools/make-sponsor-logos.py` does the image work and prints the row to paste.
The list itself is `SPONSORS` in `Quins JRT.dc.html`. Why each logo gets its
own height:
`claude/decisions/2026-08-05-supporter-logos-own-artwork-sized-by-ratio.md`.
Behaviour: `RESTORE.md` § The supporters grid (§ Artwork rules and § `h`).

## When to use

- A new supporter joins, or a supporter sends a better file.
- A logo looks soft or small on the site.

## Before you start

- Python 3 with Pillow on the PC. Pillow (`from PIL import Image`) is the
  script's only import from outside Python's standard library.
- The sponsor's files in a folder **outside the repo**. The repo root is the
  deployed site.
- Work on `dev`. This changes files the site serves, so it lands through
  `runbook-merge-dev-to-main.md`.
- **If the file is poor, ask for a better one first.** The one sentence to
  send: *"Do you have your logo as a vector, or a PNG at least 800px wide with
  a transparent background?"*

## Steps

1. **In the code:** for a new supporter, add its source file name and its
   `assets/sponsor-<name>.webp` target to `MAP` in
   `tools/make-sponsor-logos.py`. The map is written out by hand on purpose.
   Do not make it guess.
2. **In PowerShell, in the repo folder:** do a dry run first:
   `python tools/make-sponsor-logos.py --src "C:\Users\<you>\Desktop\Sponsor Logos" --dry-run`.
   Then run it again without `--dry-run`. The script keys the white out
   (`alpha = 255 - min(r,g,b)`) and un-multiplies so the ink keeps its colour.
   It then crops to the ink, scales **down** to 160px tall if the logo is
   larger (never up), and saves a `.webp`.
3. **In `Quins JRT.dc.html`:** paste the row the script printed into
   `SPONSORS`. Its `h` is recomputed from the new crop
   (`round(83.5 / sqrt(width / height))`, clamped to 26..68). Never copy `h`
   from the old row.
4. **For an opaque badge** (a logo on its own solid ground rather than on
   white): keying would eat the badge. Set its `h` by hand and write the reason
   in a comment beside the row, the same way the existing hand-set row does.
5. **In `tests/_prove-registration.js`:** add a new `assets/sponsor-*.webp` to
   `NEEDED`. An existing one must stay there.
6. **In PowerShell:** run `powershell tests/runall.ps1`.
7. **In PowerShell:** stage the `.webp`, `Quins JRT.dc.html` and any edited
   tool or test by explicit path.

## How to verify

- **On `https://dev--adhquins-jrt.netlify.app`, at desktop and phone width:**
  the logo shows on its dark tile, is not stretched, links to the sponsor, and
  looks in proportion with its neighbours.
- The suite is green, including the supporters checks.

## If it fails

- **The script stops on a missing source file:** it refuses rather than skips,
  on purpose. Fix the name in `MAP` or in the folder. Do not delete the entry.
- **The logo is small and soft:** the source is under 160px tall and was not
  upscaled, by design. Ask the sponsor for a better file.
- **The prover reports a missing file:** `NEEDED` names an asset that was
  renamed. Update the path; do not remove it.
