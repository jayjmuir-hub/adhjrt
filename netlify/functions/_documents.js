// netlify/functions/_documents.js
//
// DOCUMENTS SHARED WITH MANAGERS — every decision, none of the plumbing.
// Spec: claude/specs/spec-documents.md
//
// ---------------------------------------------------------------------
// WHY THIS FILE IS DEPENDENCY-FREE, AND WHY THAT IS NOT TIDINESS.
// ---------------------------------------------------------------------
// A fresh clone has no node_modules. `_auth.js` pulls in bcryptjs, so anything
// that requires it cannot be loaded by a test AT ALL. `_password.js` is split
// out for exactly this reason and the same reasoning applies here: the rules
// below are policy, not cryptography. Keeping them out of `_auth.js` is what
// lets `tests/test-documents.js` require this file directly and DRIVE it.
//
// A test that needs `npm install` first is a test that eventually stops
// being run. Every dependency here is INJECTED — see handleDocuments().
//
// `documents.js` is the thin adapter: it verifies the token, builds the blob
// stores, and turns the answer into an HTTP response. It contains no decisions.

/* ===================================================================
   SIZE — MEASURED, NOT INFERRED (7 August 2026)
   ===================================================================

   ⚠️ THE SPEC'S FIRST DRAFT SAID 10 MB AND WAS WRONG. Its second answer,
   ~4.4 MB, was inferred from AWS Lambda's documented 6 MB invocation cap
   rather than stated by Netlify — and this project has already shipped one
   assumed number as fact (the "env vars need no deploy" claim, wrong for a
   week). So it was MEASURED against the live gateway, which refuses oversize
   bodies before it touches anything:

       5,242,880 B (5.00 MiB)  -> reached our code
       6,242,304 B (5.95 MiB)  -> reached our code
       6,279,168 B (5.988 MiB) -> reached our code   <- last confirmed pass
       6,285,312 B (5.994 MiB) -> 413 from the platform
       6,291,456 B (6.00 MiB)  -> 413 from the platform

   So the real ceiling is ~6,282,000 bytes: 6 MiB minus ~9 KB of Lambda event
   envelope. A reading that FAILS as well as one that passes, because a size
   that succeeds proves nothing about where the edge is.

   A file has to be base64'd into JSON, which costs 4/3, so the largest file
   that physically fits is ~4.7 MiB. 4 MiB is that with ~12% headroom for the
   JSON envelope, the filename, the tags and the metadata — and it is a round
   number that can be said in an error message without qualification. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/* ⚠️ THE 413 CARRIES AN EMPTY BODY — no JSON, no sentence, because the
   platform kills the request before our function runs. So the picker MUST
   check the size client-side and refuse in its own words. This is the
   "a refusal and a network failure must stay different" rule from the
   registration gateway: a 413 with no body parses as NEITHER, and a coach
   told "check your connection" about a file that is simply too big goes
   round in circles for ever. The client cap and this one are asserted equal
   in tests/test-documents.js. */

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 400;
const MAX_FILENAME = 200;
const MAX_TAGS = 20;

/* ===================================================================
   TYPES — CHECKED ON THE BYTES, NEVER ON THE NAME
   ===================================================================

   `draw.pdf` is a filename and anybody can call anything that. A client-side
   `accept=` attribute is a convenience for the file picker and nothing more.

   ⚠️ XLSX AND DOCX ARE BOTH ZIP FILES and cannot be told apart by magic bytes
   alone — both start `PK\x03\x04`. That is not a hole being waved through: the
   check is "the bytes are a zip AND the declared type is one of the two office
   types we allow", so a renamed .exe still fails because it is not a zip. What
   it cannot catch is an xlsx declared as a docx, which is a mislabelled
   spreadsheet, not an attack. Written down so nobody "fixes" it by deleting
   the zip branch and letting the filename decide instead. */
const SIGNATURES = [
  { family: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },                          // %PDF
  { family: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { family: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { family: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },                          // PK..
];

/* An allow-list, not a block-list — everything a tournament actually sends.
   A block-list is a list of the attacks you already thought of. */
const ALLOWED_TYPES = {
  'application/pdf': { family: 'pdf', label: 'PDF', ext: 'pdf' },
  'image/png': { family: 'png', label: 'PNG image', ext: 'png' },
  'image/jpeg': { family: 'jpg', label: 'JPEG image', ext: 'jpg' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    { family: 'zip', label: 'Excel spreadsheet', ext: 'xlsx' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    { family: 'zip', label: 'Word document', ext: 'docx' },
};

/* The sentinel meaning "every signed-in manager, plus organisers". It is the
   SAME sentinel `_auth.js` already uses for an all-groups manager, so the
   filter reuses machinery that is already tested rather than inventing a
   second idea of "everyone".

   ⚠️ IT DOES NOT MEAN THE PUBLIC. Jay, 7 Aug: documents are never public.
   `/rules` is the public surface. A signed-out request gets a 401, not a file. */
const ALL_GROUPS = '*';

/* ---------------------------------------------------------------- */

/** Read the leading bytes and say which family they are, or null. */
function sniff(buf) {
  if (!buf || typeof buf.length !== 'number') return null;
  for (let i = 0; i < SIGNATURES.length; i++) {
    const sig = SIGNATURES[i];
    if (buf.length < sig.bytes.length) continue;
    let ok = true;
    for (let j = 0; j < sig.bytes.length; j++) {
      if (buf[j] !== sig.bytes[j]) { ok = false; break; }
    }
    if (ok) return sig.family;
  }
  return null;
}

/**
 * Is this file allowed? Returns a sentence for the organiser, or null.
 * Both halves must pass: the declared type is on the allow-list AND the
 * actual bytes match that type's family.
 */
function typeProblem(contentType, buf) {
  const allowed = ALLOWED_TYPES[String(contentType || '').toLowerCase()];
  if (!allowed) return 'That file type is not supported. Please upload a PDF, PNG, JPG, XLSX or DOCX.';
  const actual = sniff(buf);
  if (actual === null) return 'That file could not be read as a PDF, image or Office document.';
  if (actual !== allowed.family) return 'That file’s contents do not match its type. Please re-save it and try again.';
  return null;
}

/** The human name of an allowed type, for the list. */
function typeLabel(contentType) {
  const a = ALLOWED_TYPES[String(contentType || '').toLowerCase()];
  return a ? a.label : 'File';
}

/**
 * Tidy a tag list into either ['*'] or a sorted list of known age-group ids.
 * `knownIds` is injected so this file never carries a second copy of the
 * fifteen groups — _agegroups.js is the one list and a drift there would
 * silently detach a document from the group it was meant for.
 */
function cleanTags(tags, knownIds) {
  const known = Array.isArray(knownIds) ? knownIds : [];
  if (!Array.isArray(tags)) return [];
  /* ⚠️ '*' WINS OUTRIGHT rather than being merged with specific groups.
     ['*','u12'] is somebody's half-finished edit and it has two readings —
     "everyone" and "u12 plus everyone" — which are the same set, so keeping
     both is a row that says something ambiguous for ever. */
  if (tags.indexOf(ALL_GROUPS) > -1) return [ALL_GROUPS];
  const out = [];
  for (let i = 0; i < tags.length; i++) {
    const t = String(tags[i] || '').trim();
    if (!t) continue;
    if (known.indexOf(t) === -1) continue;   // unknown id dropped, never guessed at
    if (out.indexOf(t) === -1) out.push(t);
  }
  return out.sort();
}

/**
 * ⚠️ THE ONE RULE THAT MATTERS. A session sees a document when the document
 * is tagged for everyone, or the session is an all-groups session, or the
 * document names the session's own group.
 *
 * `ageGroupId` MUST come from the verified token. There is deliberately no
 * parameter here that a request body could fill — that is the rule
 * `my-account.js` was built on, and it is the only thing between
 * "download my group's documents" and "download anybody's".
 */
function tagsAllow(tags, ageGroupId) {
  const list = Array.isArray(tags) ? tags : [];
  if (list.indexOf(ALL_GROUPS) > -1) return true;
  if (ageGroupId === ALL_GROUPS) return true;
  if (!ageGroupId) return false;
  return list.indexOf(ageGroupId) > -1;
}

/**
 * Can this session have this document at all?
 *
 * ⚠️ HIDDEN IS CHECKED HERE, NOT ONLY IN THE LISTING. A filter applied only
 * to the list is not a filter: a manager who kept the URL would still have a
 * withdrawn file, which is the exact failure the delete button exists to
 * prevent. Organisers see hidden rows in their own shelf — that is what the
 * `isOrganizer` branch is for — but a manager never does.
 */
function canRead(doc, session) {
  if (!doc) return false;
  const s = session || {};
  if (s.isOrganizer) return true;               // organisers see everything, always
  if (doc.hidden) return false;                 // withdrawn: gone for managers immediately
  return tagsAllow(doc.tags, s.ageGroupId);
}

/**
 * The list a session is allowed to see, newest first.
 * `includeHidden` is only ever true for an organiser — the caller decides,
 * and canRead() is still applied per row so the two cannot disagree.
 */
function visibleDocs(index, session, opts) {
  const o = opts || {};
  const list = Array.isArray(index) ? index : [];
  return list
    .filter((d) => canRead(d, session))
    .filter((d) => (o.includeHidden ? true : !d.hidden))
    .slice()
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
}

/** Refuse bad metadata by name, rather than silently trimming it away. */
function metaProblem(meta, knownIds) {
  const m = meta || {};
  const title = String(m.title || '').trim();
  if (!title) return 'Please give the document a title.';
  if (title.length > MAX_TITLE) return `That title is too long (maximum ${MAX_TITLE} characters).`;
  if (String(m.description || '').length > MAX_DESCRIPTION) {
    return `That description is too long (maximum ${MAX_DESCRIPTION} characters).`;
  }
  const filename = String(m.filename || '').trim();
  if (!filename) return 'That file has no name.';
  if (filename.length > MAX_FILENAME) return 'That file name is too long.';
  if (Array.isArray(m.tags) && m.tags.length > MAX_TAGS) return 'Too many age groups selected.';
  const tags = cleanTags(m.tags, knownIds);
  /* ⚠️ AN EMPTY TAG LIST IS REFUSED, NOT TREATED AS "EVERYONE". Defaulting a
     blank selection to '*' would publish a document to all fifteen groups
     because somebody forgot to tick a box — and the failure is silent, because
     the upload succeeds and looks right in the organiser's own shelf, which
     shows everything regardless of tags. Fail closed and ask. */
  if (!tags.length) return 'Please choose who this document is for.';
  return null;
}

/* ⚠️ THE FILENAME IS SANITISED BEFORE IT IS EVER USED AS A BLOB KEY OR SENT
   AS A DOWNLOAD NAME. Same rule `_ratelimit.js` applies to the client address
   and `_signins.js` to the username: a name containing a slash must not be
   able to choose its own key in a store, and a name containing a quote or a
   newline must not be able to break out of a Content-Disposition header. */
function safeFilename(name) {
  return String(name || 'document')
    .replace(/[\r\n"\\]/g, '')
    .replace(/[/:*?<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME) || 'document';
}

/* A document id. Injected clock and counter rather than Date.now()/random,
   so a test can drive it and get the same answer twice. */
function makeId(nowMs, seq) {
  return 'd' + Number(nowMs).toString(36) + '-' + String(seq).padStart(4, '0');
}

module.exports = {
  MAX_FILE_BYTES,
  MAX_TITLE,
  MAX_DESCRIPTION,
  MAX_FILENAME,
  MAX_TAGS,
  ALLOWED_TYPES,
  SIGNATURES,
  ALL_GROUPS,
  sniff,
  typeProblem,
  typeLabel,
  cleanTags,
  tagsAllow,
  canRead,
  visibleDocs,
  metaProblem,
  safeFilename,
  makeId,
};
