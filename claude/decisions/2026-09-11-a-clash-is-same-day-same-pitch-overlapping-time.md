# A clash is two bookings on the same day, the same pitch and overlapping times, and nothing else

**Ruling.** `weekendClashes()` books each pool once for its run of matches, and each knockout match on its own. A pool split across pitches by hand is booked once per pitch. Pitch names ignore case. Times are half-open: a booking ending at 10:00 and another starting at 10:00 do not clash. Not a clash: one pitch at different times, which is a time-share; the same pitch name on different days; TBD or no pitch, listed separately as unplaced. If the check itself fails, the publish confirmation says so and still offers Publish anyway.

**Why.** Each non-clash is how the venue really runs, and flagging it would teach people to ignore the warning. Booking per pitch stops a hand-moved match escaping the check. A check that cannot run must not become a check that says no on match morning.

**Against, and why it lost.** Blocking the publish when the check fails is safer on paper, but it locks out whoever must move a game on the day.

**Where in the code.** `scores-data.js` (`weekendClashes`), `Manager.dc.html` (`doPublish`), `tests/test-manager-dc-draw.js`.
