# The draw editor is tap-to-select, and a placed team always leaves where it came from

**Ruling.** A team is placed in a pool, a pool match slot or a knockout slot by tapping it, then tapping the destination. Tapping the same source again deselects. An occupied slot is both a pickup source and a drop target, depending on whether something is already picked. Every placement first removes the team from its origin, for all three destination kinds. There is no separate knockout roster: a team reaches a knockout slot from its pool card. Every mutator that could leave the selection pointing at stale data clears it. There is one draw editor: the Draw tab on `/manager`.

**Why.** HTML5 drag-and-drop is unreliable on touch, and managers work from phones; tap-to-select works equally well with a mouse. The old editor removed a team from its origin only on pool drops, so a team moved between match slots ended up in both.

**Against, and why it lost.** One shared editor module for every page was rejected as a bigger, riskier rewrite with no behaviour gained. It became moot once the second editor was deleted with the manager area of `/scores`.

**Replaces.** The drag-and-drop editor in `Scores & Standings.dc.html`.

**Where in the code.** `Manager.dc.html` (`pickTeam`, `removeFromSource`), `tests/test-manager-dc-draw.js`.
