# Back-office palette — re-point it at new brand values

The back office (`Signin.dc.html`, `Manager.dc.html`, `Organizer.dc.html`)
takes its colours from one `:root` token block in each file, and the three
blocks must be byte-identical. When the club brand changes, you re-point the
back office by editing that block, identically in all three files. Why:
`claude/decisions/2026-08-22-backoffice-wears-club-brand-tokens.md`.
Behaviour: `RESTORE.md` § Brand.

## When to use

- The Club Hub palette changes and the back office should follow it.
- Any colour change to the back office's header, sidebar or tab bar.

## Before you start

- Work on `dev`. Look at the result on the free branch deploy before any merge.
- Have the new values from the Club Hub's palette.

## Steps

1. **In the code:** change the values inside the `:root{…}` block in
   `Signin.dc.html`. Copy the block, byte for byte, into `Manager.dc.html` and
   `Organizer.dc.html`. `tests/test-backoffice-retheme.js` checks that the
   three copies agree.
2. **If you replace more raw hex colours with `var(--…)`** using a script
   (the transformer), it must skip comments. Several comments quote old hex
   values on purpose (tombstones). Ignore comments when matching; never delete
   them from the file.
3. **Search for 8-digit hexes too** (`#RRGGBBAA`), not only 6-digit ones. The
   age-group chart tints (`AGE_TINT`) have an opacity suffix added in
   JavaScript (`${t}30`). A `var()` there produces invalid CSS and a
   see-through chip with no error. Leave those as literal hexes.
4. **In PowerShell:** run `powershell tests/runall.ps1`. Expect some prover
   faults to report COULD NOT INJECT where a check anchored on an old colour.
   **Repoint each one in the same commit.** Never delete one.
5. **Render audit:** every tab on both dashboards, at desktop and 390px,
   signed-in states included. See `runbook-rendered-audits.md` § E.
6. **In a browser:** sign in on `https://dev--adhquins-jrt.netlify.app` and
   check both dashboards.

## How to verify

- `tests/test-backoffice-retheme.js` passes. It checks for one token block per
  file, that the three copies are identical, and colour contrast for the
  pairings it computes from the block itself.
- The render audit finds no tab where the change did not apply.

## If it fails

- **"the three token blocks are byte-identical" fails:** one copy differs,
  often by line endings or a trailing space. Copy it again from
  `Signin.dc.html`.
- **A chip turns see-through:** an 8-digit hex was converted to `var()`. Put
  the literal back.
- **The contrast checks fail:** the new colour pairing is too faint for its
  text. Choose a stronger value. Do not loosen the check.
