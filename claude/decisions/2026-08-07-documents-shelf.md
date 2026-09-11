# Documents for managers are uploaded to Blobs, tagged by age group, and filtered server-side on every download

**Ruling.** Organisers upload, edit, delete, restore and purge documents on `/organizer`; managers only list and download on `/manager`. Each document is tagged with age groups or `*`, meaning every signed-in manager and organiser, never the public. The download function enforces the tag and the hidden flag against the verified token, not only the list. Delete hides at once; purge is a separate, typed-confirmation action. Types are an allow-list checked on the bytes, not the filename. Files live one key each, apart from the index. A failed read shows a message distinct from an empty shelf; a failed write refuses.

**Why.** A manager must see their group's current documents without asking. A list-only filter would leave a withdrawn or foreign file reachable by URL.

**Against, and why it lost.** `/app` is open on the touchline, but offline documents are a new surface. Public documents already have the rules page. Soft delete keeps bytes stored, accepted because a match-morning misclick otherwise has no undo. The single index can lose a simultaneous upload, accepted for a few organisers.

**Where in the code.** `netlify/functions/_documents.js`, `netlify/functions/documents.js`, `tests/test-documents.js`.
