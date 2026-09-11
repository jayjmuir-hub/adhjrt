# On the manager score sheet, 0–0 is a real draw, cards carry no points, and the Spirit nomination lives on the sheet

**Ruling.** Saving an all-zero score asks for confirmation, because 0–0 is a draw worth league points. It is not the same as Clear result, which returns the match to unplayed and also needs confirming. Each side's score sheet has a cards count. Cards are left out of the total and do not make a sheet count as scored. The Spirit of Rugby nomination sits in each team's box on the same sheet, shown only where `supportsSpiritAward` says the age group takes part. The running tally appears on Fixtures & scoring, not as a separate tab.

**Why.** An accidental 0–0 silently gives both teams points. A card counted as a score would change standings. A nomination is made at the moment a result is entered, so it belongs there.

**Against, and why it lost.** A separate Spirit tab would keep the sheet shorter, but managers would forget it after the final whistle. Saving 0–0 without asking is faster, but a mistyped save is harder to spot than one extra tap.

**Where in the code.** `Manager.dc.html`, `scores-data.js`, `tests/test-manager-dc-score-sheet.js`.
