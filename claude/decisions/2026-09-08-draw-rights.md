# Managers are results-only by default; draw rights are per-manager switches and publishing is organiser-only

**Ruling.** A manager has two draw rights, off unless ticked by an organiser on the Accounts tab: pools and teams, kickoff times and pitches. With neither, the Draw tab is read-only. The server re-reads rights on every request, comparing a partial-rights save against the stored draft, never what the client claims. Only organisers publish. A manager's saves are refused from midnight Gulf time on their group's day. A manager with a right can send a draft for review — emailing organisers, shown on the organiser page. Every save or reset files a history entry an organiser can restore, newest ten kept.

**Why.** Not every manager can safely run the editor. Times and pitches span groups, seen whole only by the clash check; pools affect one group. Publishing changes what parents see.

**Against, and why it lost.** Managers know their group best and the desk becomes a bottleneck; the pools switch answers that. One switch is simpler, but grants cross-group fields to anyone trusted with pools. Approve-then-manager-publishes adds a third stored state. A late withdrawal at 07:00 goes to the desk, by design.

**Replaces.** The rule letting managers publish on tournament days.

**Where in the code.** `netlify/functions/_drawRights.js`, `netlify/functions/save-schedule-override.js`, `netlify/functions/_publish.js`, `netlify/functions/draw-review.js`, `netlify/functions/draw-history.js`, `tests/test-draw-rights.js`.
