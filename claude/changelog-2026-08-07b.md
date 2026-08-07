# ADH JRT — changelog, 7 August 2026 (part 2)

> **Read this BEFORE `claude/changelog-2026-08-07.md`.** Chain:
> **this file → `changelog-2026-08-07.md` → `changelog-2026-08-06.md` →
> `changelog-2026-08-05.md` → `changelog.md`.**
>
> ⚠️ **Why a second file for the same day rather than a section prepended to
> part 1.** Part 1 was written an hour earlier and exists only in the Claude
> project. Prepending to it means retyping every existing byte through the
> model, and this project has paid twice for the lesson that bytes do not
> survive being re-emitted. The 5 Aug and 6 Aug files were split off for the
> same reason and each says so in its own header; this is that rule being
> followed, not an accident of tooling. If these are ever merged, do it with a
> real file transfer.
>
> ⚠️ **PART 1 CONTAINS A CLAIM THAT IS HALF TRUE AND IS NOT CORRECTED THERE.**
> Its "Verified: the rendered box is 118×118 at (101,64) at both t=0.5s and
> t=5.5s — unrotated, exactly the badge position, flush in the hole at both
> ends" is accurate about the box and **wrong about the conclusion**. Read the
> section below before believing it.

## ⚠️⚠️ THE BAT DID NOT FIT ITS OWN HOLE — JAY SPOTTED IT, AND MY VERIFICATION HAD SAID IT DID (`5bb5f1e`, LIVE)

Jay, with a screenshot: *"the bat is not sitting properly on the logo, it
should sit exactly as it does on the static version."* A second 15-credit
deploy on the same feature.

`flapL`/`flapR` read `rotate(8deg)` / `rotate(-8deg)` at **both** 0% and 100%.
The fill mode is `both`, so the 0% frame applies through the half-second delay
**before** the flight and the 100% frame applies for ever **after** it. The bat
therefore sat in `crest-shield.png`'s bat-shaped hole with its wings splayed
eight degrees — permanently, at both ends of the animation, in a hole cut for a
level bat.

Fixed by running the sweep from neutral instead of from a splay: `0 → −34 → 0`
rather than `8 → −26 → 8`. The amplitude is unchanged at 34 degrees.

### ⚠️ THE SECTION ABOVE CLAIMS A VERIFICATION THAT WAS HALF TRUE, AND THAT IS THE LESSON

It says: *"the rendered box is 118×118 at (101,64) at both t=0.5s and t=5.5s —
unrotated, exactly the badge position, flush in the hole at both ends."* Every
word of that is accurate **and it does not mean what it was taken to mean.**

`.cf` is the flight layer. The wing layers are `inset:0` **inside** it and
rotate about their own shoulders, so `.cf`'s bounding rectangle is 118×118
whether the wings are level or splayed. **The measurement could not see the
wings at all.** Twenty-two flight-geometry checks, sixty-one sample points and
a real browser render all passed on a bat that was visibly wrong.

**"I measured it" is not the same as "I measured the thing that was wrong."**
The element under the ruler has to be the element that can move. This is the
same shape as the HSBC header measurement that checked for wrapping and missed
a horizontal overflow — a measurement only answers the question you asked it.

### What actually catches it

Rendering the resting crest and comparing it, pixel for pixel, against
`crest.png` — the **complete printed crest**. Shield + bat at rest and the
printed crest are the same picture, or the bat does not fit. Before the fix they
were two different pictures; after it, mean absolute difference **17/765**,
confined to anti-aliased edges from the two files' differing native sizes.

That comparison needs a browser, so it cannot live in the Node suite. What does
live there is the invariant it proved: **every animated layer's first and last
frame is the identity transform**, asserted on both wings at both ends.

⚠️ **Both ends, not one.** A check on the 0% frame alone is satisfied by a bat
that takes off level and lands splayed — which is the *worse* half, because
landed is the state the page spends its life in. There is a fault for exactly
that, alongside one that restores the shipped bug verbatim.

**Suite 277 → 284 checks; prover 717 → 719 faults, 719/719 caught, 33 suites
clean.** Verified live on adhjrt.com with comments stripped: both keyframes read
`rotate(0deg)` at 0% and 100%, and `rotate(±8deg)` appears **zero** times
anywhere in the live page.

## Still outstanding from part 1

- **`compare--adhquins-jrt.netlify.app` is password-protected**, so a branch
  preview cannot be eyeballed by a driven browser without the password.
- **Two bundles left on cafnet** — `C:\Users\Jay\GitHub\batwings.bundle` and
  `batrest.bundle`. The device bridge cannot delete; they want removing by hand.
- `Compare` is still in the Netlify branch-deploy allow-list and still exists
  on `origin`, byte-identical to `main` — same note as 6 Aug.

## ⚠️ TWO PRODUCTION DEPLOYS FOR ONE FEATURE — 30 CREDITS

Part 1 and this correction are two separate 15-credit deploys of the same bat.
The standing rule is *"do not iterate on appearance one deploy at a time"*, and
this is what that costs when the appearance check is aimed at the wrong element.
The preview branch could not be used to avoid it — it is password-protected, so
it cannot be measured by script — and the harness that stood in for it measured
`.cf` rather than the bat inside it. **The cheap fix available next time is to
render the resting crest and diff it against `crest.png` BEFORE the first
deploy**, which takes about a minute and would have caught both the landing
angle and the splayed wings.
