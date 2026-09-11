# Post-tournament clear-down — documents shelf

Nothing on the site clears itself after the tournament. This runbook covers
the documents shelf. For the other stores, use the runbooks listed under
*When to use*. Why deletion is by hand:
`claude/decisions/2026-08-07-documents-shelf.md`. Behaviour: `RESTORE.md`
§ Documents shared with managers.

## When to use

- After the tournament, when the maintainer decides the shared documents are
  no longer needed.
- Registrations: `runbook-registrations-restore-and-delete.md` § C (season
  end).
- Draws, results and publication state:
  `runbook-clearing-the-rehearsal-data.md`. The same tools clear real data.

## Before you start

- You are signed in to `/organizer` as an organiser.
- Keep your own copy of any document you may need again. **Delete for good**
  cannot be undone.

## Steps

1. **In `/organizer` → Documents tab:** press **Stop sharing** on each
   document. It disappears from every manager's list at once, and the server
   refuses downloads of it too. The file itself is kept.
2. **In `/organizer` → Documents tab:** press **Show unshared** to list those
   documents.
3. **For each document to remove completely:** press **Delete for good**, type
   the document's title exactly as shown, and confirm.

## How to verify

- **Signed in as a manager, or through the age-group switcher:** the
  Documents tab lists none of the documents you cleared.
- **In `/organizer`, with Show unshared on:** only the documents you chose to
  keep remain.

## If it fails

- **Delete for good does not appear:** the typed title does not match
  exactly. Copy it from the grey placeholder text in the box.
- **A manager still has a document:** it was missed in step 1. Stop sharing
  it; the server then refuses the download too.
