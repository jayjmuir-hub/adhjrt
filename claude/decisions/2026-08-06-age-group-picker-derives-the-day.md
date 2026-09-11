# The age-group picker is grouped by day, and each group's day comes from the venue layout, never a typed list

**Ruling.** On `/app` and `/scores` the age groups sit in two day blocks. A group's block comes from the venue layout, so moving a group in the back office moves it here with no deploy. Chip labels split at the first space: age band large, format small; a name without a space shows whole. Day colour marks the block as well as the selected chip. There is no colour per age group, and nothing is dimmed for being unpublished. U6 and U7 stay off `/scores`, which has no standings for them. The `/scores` picker still calls `onAgeChange`.

**Why.** A typed list of groups next to a day once put groups on the wrong day on the public site. A flat strip with a hidden scrollbar hid most groups.

**Against, and why it lost.** A hardcoded list is shorter to write, and it is the exact bug this replaces. Fifteen tints would read as confetti, not navigation. The girls' groups stay in age order; clustering them is editorial.

**Where in the code.** `app.html`, `Scores & Standings.dc.html`, `scores-data.js`, `tests/test-age-group-picker.js`.
