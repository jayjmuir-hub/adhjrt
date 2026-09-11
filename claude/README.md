# claude/ — what is here, and what was removed

**Here:** `decisions/` (one card per ruling: what was decided, why, and the
argument against it), `runbooks/` (procedures, steps only). The rules are in
`/CLAUDE.md`; how the code behaves is in `/RESTORE.md`.

**Removed by the documentation cut**
(`claude/decisions/2026-09-10-documentation-cut.md`), with where their content
went:

| Was | Now |
|---|---|
| `state-of-play.md`, `parked-requests.md` (status, open items) | Linear, team "ADH JRT Team", tickets `JRT-<n>` |
| `lessons.md` (lessons learned) | rules in `/CLAUDE.md`; procedures in `runbooks/`; reasons in `decisions/` |
| `changelog*.md`, `handoff-*.md` (session diaries) | git history. What survives as behaviour is in `/RESTORE.md` |
| `writing-to-github-from-claude.md` (already a tombstone) | `runbooks/runbook-git-bundle-between-pcs.md` |
| `specs/`, `plans/`, `archive/` | see the README in each |

Status rots by design, so it lives in a tracker, not in a file every session
reads. **Do not start a new status or lessons file here.** Source comments that
cite the removed paths are left alone on purpose; the old files are in git
history before the cut commit.
