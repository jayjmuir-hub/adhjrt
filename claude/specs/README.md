# claude/specs/ — removed

This folder held the design specs, one per feature, written before the code.
They mixed the ruling, the argument, the build plan and the history in one
narrative. The documentation cut
(`claude/decisions/2026-09-10-documentation-cut.md`) replaced them:

- **the rulings and the arguments against them** → one card each in
  `claude/decisions/` (the map from each spec to its cards is
  `claude/decisions/MAPPING.txt`);
- **how the built code behaves** → `RESTORE.md`;
- **open work** → Linear, team "ADH JRT Team", tickets `JRT-<n>`.

About 55 source comments still cite a `claude/specs/…` path. They are left
alone on purpose (rewriting them is churn with no behaviour change). To read a
cited spec, look it up in `MAPPING.txt` for its card, or read it from git
history before the cut commit.

**Do not recreate this folder.** A new feature's decision goes in a card.
