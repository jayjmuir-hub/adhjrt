# Results storage never migrates: older layouts are read as fallbacks, and clearing writes a tombstone

**Ruling.** Three layouts are read in rising order of authority: the legacy `all` blob, the `ag:<group>` blobs, then the `m:<match>` blobs. Nothing copies, rewrites or deletes the older two. An edited match moves to its own blob. Clearing a match writes `{ cleared: true }` to its key and never deletes. `readMatch` rethrows a read failure, so the save and clear paths refuse rather than carry on with an empty answer; the public readers log the failure and serve what they can. `readGroup` and `readAll` apply the same precedence, so the manager's view and the public view cannot disagree.

**Why.** With no migration, no result is ever in neither place, and rolling back loses only what was saved since. A plain delete would let the next read fall through to an older layout and bring the cleared result back.

**Against, and why it lost.** A one-off migration would leave one layout and less code. It needs a window where writes are unsafe, and tombstones cost a few bytes each.

**Where in the code.** `netlify/functions/_results.js` (`LEGACY_KEY`, `isTombstone`, `clearMatch`, `readGroup`, `readAll`), `netlify/functions/submit-result.js`, `tests/test-results-storage.js`.
