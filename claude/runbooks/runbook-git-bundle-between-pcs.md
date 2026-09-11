# Move work between PCs with a git bundle

Carries commits made in a sandbox or one PC's clone across to another
machine's clone, as real git objects — never as text retyped through a model,
which is the one thing that reliably corrupts bytes. Use this for a branch or
several commits; a single small text edit can go straight through a file-edit
tool instead.

## When to use

- Work was committed in a cloud sandbox (which can read `origin` but never
  push to it — a push from there returns 403) and needs to land on a PC that
  can push for real.
- Moving more than a file or two, or anything binary, between two clones on
  different machines.

## Before you start

- Know which branch the bundle is carrying, and know it will land on a
  branch of the **same name** on the destination — never invent a scratch
  branch name partway through this.
- Pick a scratch folder that is a **sibling of the clone, never a child of
  it** — for example `C:\Users\jayjm\GitHub\_scratch`, next to
  `C:\Users\jayjm\GitHub\adhjrt`. The repo root is the deployed site; a
  scratch folder inside it risks being served or committed by accident.
- The scratch folder needs a permission grant on its **parent** directory
  (e.g. `C:\Users\jayjm\GitHub`), not on the repo clone itself.

## Steps

1. **In the sandbox (or source machine), in the repo:** create the bundle
   against the branch it will land on.

   ```
   git bundle create x.bundle origin/<branch>..<branch>
   ```

2. **In the sandbox:** check what ref name the bundle actually carries before
   writing anything else — this is not optional. A bundle made with
   `origin/main..HEAD` names its ref `HEAD`, not the branch name, and the
   fetch in step 5 needs the real name.

   ```
   git bundle list-heads x.bundle
   ```

3. **Wherever your host's file-transfer tool applies** (e.g. `SendUserFile` →
   `device_commit_files` in this project's usual bridge): copy `x.bundle`
   into the scratch folder on the destination PC. Content moves as bytes
   here, not as text through a model, so this step is safe for any size or
   binary content.

4. **In PowerShell, on the destination PC:** verify the bundle is intact.

   ```
   git bundle verify <scratch>\x.bundle
   ```

   This prints the ref the bundle carries — it should match what
   `list-heads` reported in step 2.

5. **In PowerShell, in the destination clone:** fetch using the **source**
   ref name from step 2, and no destination refspec.

   ```
   git fetch <scratch>\x.bundle <branch>
   git merge --ff-only FETCH_HEAD
   ```

   Do not write `<branch>:<branch>` — that fails with "refusing to fetch
   into branch" while `<branch>` is checked out. Do not omit the ref
   entirely — a bare `git fetch <bundle>` asks for `HEAD`, which a
   `<branch>`-named bundle does not carry, and fails with "couldn't find
   remote ref HEAD".

6. **In PowerShell, on both machines:** compare tree hashes — the proof that
   the checkout is the one that was built and tested, not merely that the
   bundle transferred without error.

   ```
   git rev-parse '<branch>^{tree}'
   ```

   Quote `^{tree}` — PowerShell can otherwise treat it as `-encodedCommand`
   and fail on a base64-looking string.

7. **In PowerShell, on the destination PC:** delete the bundle and clear the
   scratch folder's contents once the merge is confirmed.

## How to verify

- `git bundle verify` reported the bundle intact and named the expected ref.
- The tree hash from step 6 is identical on the sandbox/source side and the
  destination side.
- The scratch folder is empty again afterwards.

## If it fails

- **"fatal: refusing to fetch into branch 'refs/heads/`<branch>`'"** — you
  wrote a destination refspec (`<branch>:<branch>`) while that branch was
  checked out. Re-run the fetch with just the source ref, as in step 5.
- **"fatal: couldn't find remote ref HEAD"** — you omitted the ref entirely.
  Re-run `git bundle list-heads` (step 2) and fetch that exact name.
- **The tree hashes in step 6 don't match** — something changed between
  building the bundle and merging it (a later commit on either side, or a
  bundle built against the wrong base). Do not keep going; re-bundle from a
  freshly fetched `origin` and repeat from step 1.
- **The scratch folder's permission dialog times out** — it has to be
  granted again; there is no way around re-granting it. Ask for the grant on
  the **parent** folder, not the clone.
- **Line endings look wrong after the merge (a check that used to pass now
  fails on whitespace)** — this is the reason to prefer the bundle route
  even for a couple of text files: a file written directly into the clone by
  another tool can land LF where the checkout is CRLF. Re-do the transfer as
  a bundle instead of a direct file write.
