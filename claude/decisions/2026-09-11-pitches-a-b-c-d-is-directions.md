# "Pitches A, B, C & D" on the homepage and in the app is a direction, not a count, and stays literal

**Ruling.** The venue block on the homepage and on `/app` says "Pitches A, B, C & D" next to the signage note. It names the areas of the ground a visitor walks to, and is left as literal text. The number of pitches is shown separately, in the homepage PITCHES stat, which reads its count from the venue layout and falls back to a written-down value if the layout cannot be loaded.

**Why.** The four letters are the ground's signposted areas and do not change when an organiser splits or merges pitches. Deriving them from the layout would turn a direction into a list of surface names such as `D3a`, which no visitor can follow.

**Against, and why it lost.** Everything else about pitches derives from the layout, so a literal looks like the drift this site keeps removing. It is not the same fact: the layout counts playing surfaces, and this line tells people where to go.

**Where in the code.** `Quins JRT.dc.html` (the venue block and `statPitches`), `app.html`.
