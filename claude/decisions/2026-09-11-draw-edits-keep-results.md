# A draw edit never strands a recorded score

**Ruling.** A slot with a recorded result keeps its id and every team it named; only its time and pitch may change.
- The Draw tab's rebuild (per pool and "Regenerate all") keeps each existing pairing's slot, its id and its home/away sides. If a scored match would still be dropped, the rebuild is refused before it is offered, and the refusal names the match.
- `save-schedule-override.js` refuses (409) any save that would remove a scored slot or change a team it named, **organisers included**. It refuses (503) when it cannot read the group's results.
- To drop a played match on purpose, clear its score first; result history keeps it.

**Why.** Results are stored under the match id and carry no team codes.
- Until 11 Sep 2026 every rebuild minted clock-based ids, so the scores already entered dropped out of the standings. The "Regenerate all" confirmation even said only "pairings, times, and the bracket" were rebuilt.
- Managers are frozen on match day and organisers are not, so the desk was exposed on 7–8 November. A team withdrawing is the likely trigger.
- The import's "replace" guard ran only in the browser (JRT-26), so a hand-built request could bypass it.

**Against, and why it lost.**
- *Allow it with a warning:* faster for a withdrawal, but a mis-tap or a hand-built request would still strand scores. The maintainer chose to refuse.
- *Build ids from team positions:* reordering a pool would move scores to the wrong teams, which is worse than stranding them.
- *Keep the id but take the rebuild's sides:* this silently swaps a score between the two teams. The tests pin this case.
- *Store team codes on every result so scores can be re-attached later:* a larger change to the scoring path and to the three storage layouts, and not needed once ids are kept.
- *Against the ruling itself:*
  - One extra results read per draw save.
  - Removing a played match takes extra clicks (clear the score first).
  - **Not checked in two cases:**
    - When there is no stored draft yet, because results entered against the auto-generated draw have no saved pairing to compare with.
    - On unpublish, because the public page reverts to the auto draw, which hides scores stored under rebuilt ids. They are hidden, not deleted.

**Where in the code.**
- `scores-data.js` `regeneratePoolSlots`.
- `Manager.dc.html` `scoredIds`, `lostByRebuild` and `refuseRebuild`.
- `netlify/functions/_drawRights.js` `strandedResults` and `strandedMessage`.
- `netlify/functions/save-schedule-override.js`.
- `tests/test-draw-keeps-results.js`.
