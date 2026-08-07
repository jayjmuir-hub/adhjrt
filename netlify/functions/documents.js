// netlify/functions/documents.js
//
// DOCUMENTS SHARED WITH MANAGERS — the HTTP door.
// Spec: claude/specs/spec-documents.md. Every decision is in _documents.js.
//
//   GET  ?action=list                 -> the documents this session may see
//   GET  ?action=list&deleted=1       -> organiser only: hidden ones too
//   GET  ?action=download&id=…        -> the bytes, base64, if allowed
//   POST { action:'upload',  … }      -> organiser only
//   POST { action:'edit',    id, … }  -> organiser only: title, description, tags
//   POST { action:'delete',  id }     -> organiser only: SOFT — hides it
//   POST { action:'restore', id }     -> organiser only: un-hides it
//   POST { action:'purge',   id }     -> organiser only: IRREVERSIBLE
//
// ---------------------------------------------------------------------
// THIS FILE CONTAINS NO DECISIONS, DELIBERATELY — same split as
// submit-registration.js / _intake.js, and for the same hard reason: it
// requires _auth.js, which pulls in bcryptjs, which a fresh clone does not
// have. So this file cannot be loaded by a test at all. A rule added here is
// a rule nothing can check. Keep it thin.
// ---------------------------------------------------------------------
//
// ⚠️ NOTHING HERE IS PUBLIC. Every branch below requires a verified session
// before it does anything, including the download. Jay, 7 Aug: documents are
// for signed-in managers and organisers, never the public — `/rules` is the
// public surface. A signed-out request gets a 401, not a file.

const { verify, getBearerToken, blobStore } = require('./_auth');
const { AGE_GROUPS } = require('./_agegroups');
const D = require('./_documents');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (statusCode, error) => json(statusCode, { ok: false, error });

/* The index is ONE blob rewritten whole; the bytes are one key per document.
   ⚠️ THAT SPLIT IS NOT NEGOTIABLE — putting file bytes in a rewritten-whole
   blob makes every upload rewrite every file. */
const INDEX_KEY = 'list';

/* ⚠️ THE INDEX HAS THE SAME RACE AS THE ACCOUNTS LIST, AND IT IS ACCEPTED
   KNOWINGLY (spec §4). Netlify Blobs has no compare-and-set, so two
   organisers uploading in the same second both read the list, both write it
   back, and one upload vanishes with no error anywhere. That is the July 2026
   results bug, which forced the results store to be split per age group, and
   it is why sign-in stamps live one key per person.
   Tolerated here because uploads are rare, deliberate, and done by two or
   three people — NOT because the race is not real. If documents ever become
   something people add during a tournament, split the metadata per key and
   list by prefix; the file bytes are already per key, so only this index
   moves. Do not "tidy" the accounts-style read-modify-write into more places. */

const MAX_BODY_BYTES = D.MAX_FILE_BYTES + 512 * 1024;   // file + JSON envelope

async function readIndex(store) {
  const raw = await store.get(INDEX_KEY, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

async function writeIndex(store, list) {
  await store.setJSON(INDEX_KEY, list);
}

/* The row a caller is allowed to see. The blob key and anything internal
   stay here. */
function publicRow(d, isOrganizer) {
  const row = {
    id: d.id,
    title: d.title || '',
    description: d.description || '',
    filename: d.filename || '',
    contentType: d.contentType || '',
    typeLabel: D.typeLabel(d.contentType),
    /* Whether the browser can show it inline. Decided server-side in
       _documents.js so the rule is testable and both dashboards agree —
       a page deciding for itself is two copies of one rule. */
    previewable: D.canPreview(d.contentType),
    bytes: d.bytes || 0,
    tags: Array.isArray(d.tags) ? d.tags : [],
    uploadedBy: d.uploadedBy || '',
    uploadedAt: d.uploadedAt || '',
  };
  /* A manager is never told a document is hidden — for them it does not
     exist. Only the shelf needs the flag. */
  if (isOrganizer) row.hidden = !!d.hidden;
  return row;
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    if (method !== 'GET' && method !== 'POST') {
      return fail(405, 'Method not allowed.');
    }

    /* ---- the door: a verified session, every time -------------------- */
    const session = verify(getBearerToken(event));
    if (!session) return fail(401, 'Please sign in.');
    const isOrganizer = !!session.isOrganizer || session.role === 'organizer';
    /* ⚠️ THE AGE GROUP COMES FROM THE TOKEN AND NOWHERE ELSE. There is
       deliberately no line below that reads an age group, a role or a
       username off the request. */
    const ageGroupId = isOrganizer ? D.ALL_GROUPS : (session.ageGroupId || '');
    const sess = { isOrganizer, ageGroupId };

    const files = blobStore('docfiles');
    const index = blobStore('documents');
    const knownIds = AGE_GROUPS.map((g) => g.id);

    /* ================= GET ============================================ */
    if (method === 'GET') {
      const q = event.queryStringParameters || {};
      const action = q.action || 'list';

      if (action === 'list') {
        let list;
        try {
          list = await readIndex(index);
        } catch (err) {
          /* ⚠️ FAIL SOFT ON READ, AND SAY WHICH FAILURE IT IS. Documents are
             useful; they are not the tournament. A documents outage must not
             take out a manager's fixtures and scoring. `unavailable` is what
             lets the page tell "could not load" from "none yet" — the same
             lesson as clubsUnavailable on the Clubs tab, learned three times
             in this codebase now. */
          return json(200, { ok: true, documents: [], unavailable: true });
        }
        const wantDeleted = isOrganizer && (q.deleted === '1' || q.deleted === 'true');
        const visible = D.visibleDocs(list, sess, { includeHidden: wantDeleted });
        return json(200, {
          ok: true,
          documents: visible.map((d) => publicRow(d, isOrganizer)),
          unavailable: false,
        });
      }

      if (action === 'download') {
        const id = String(q.id || '');
        if (!id) return fail(400, 'No document was named.');
        let list;
        try {
          list = await readIndex(index);
        } catch (err) {
          return fail(503, 'Documents are unavailable right now. Please try again.');
        }
        const doc = list.filter((d) => d && d.id === id)[0];
        /* ⚠️ THE SAME canRead() THE LISTING USES — hidden included. A filter
           applied only to the list is not a filter: without this line a
           manager who kept the URL still has a withdrawn file, which is
           exactly what the delete button exists to prevent.
           ⚠️ And a document this session may not see answers the SAME
           sentence as one that does not exist. "You are not allowed this" and
           "there is no such thing" are the same answer to whoever is asking;
           telling them apart is how somebody maps the shelf. */
        if (!doc || !D.canRead(doc, sess)) return fail(404, 'That document is not available.');

        let bytes;
        try {
          bytes = await files.get(doc.id, { type: 'arrayBuffer' });
        } catch (err) {
          bytes = null;
        }
        /* An index row whose bytes are gone is reachable through a partial
           delete. Say so plainly rather than serving an empty file that looks
           like a corrupt download. */
        if (!bytes) return fail(410, 'That file is missing. Please ask an organiser to upload it again.');

        return json(200, {
          ok: true,
          filename: D.safeFilename(doc.filename),
          contentType: doc.contentType,
          base64: Buffer.from(bytes).toString('base64'),
        });
      }

      return fail(400, 'Unknown action.');
    }

    /* ================= POST — organiser only ========================== */
    /* ⚠️ ENFORCED HERE, NOT BY HIDING THE BUTTON. Spec §6 rule 1. */
    if (!isOrganizer) return fail(403, 'Only organisers can change documents.');

    const raw = event.body || '';
    if (Buffer.byteLength(raw, event.isBase64Encoded ? 'base64' : 'utf8') > MAX_BODY_BYTES) {
      return fail(400, 'That file is too large. The maximum is 4 MB.');
    }

    let body;
    try {
      body = JSON.parse(event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw);
    } catch (err) {
      return fail(400, 'We could not read that request.');
    }

    const action = String((body && body.action) || '');
    const who = session.name || session.username || 'An organiser';

    if (action === 'upload') {
      const problem = D.metaProblem(body, knownIds);
      if (problem) return fail(400, problem);

      let buf;
      try {
        buf = Buffer.from(String(body.base64 || ''), 'base64');
      } catch (err) {
        buf = null;
      }
      if (!buf || !buf.length) return fail(400, 'That file appears to be empty.');
      if (buf.length > D.MAX_FILE_BYTES) return fail(400, 'That file is too large. The maximum is 4 MB.');

      /* On the BYTES, not the name — see _documents.js. */
      const typeBad = D.typeProblem(body.contentType, buf);
      if (typeBad) return fail(400, typeBad);

      let list;
      try {
        list = await readIndex(index);
      } catch (err) {
        /* ⚠️ FAIL CLOSED ON WRITE, unlike the read above. A silent success
           that stored nothing is worse than a refusal: the organiser stops
           chasing it and the managers never get the file. */
        return fail(503, 'Documents could not be saved right now. Please try again.');
      }

      const id = D.makeId(Date.now(), list.length + 1);
      /* ⚠️ THE BYTES GO FIRST. If the index row were written first and the
         file write then failed, the shelf would show a row with no file —
         the "file missing" state — for something that was never stored at
         all. This order means a failure leaves an orphan blob nobody lists,
         which is wasted space rather than a broken row. */
      try {
        await files.set(id, buf);
      } catch (err) {
        return fail(503, 'That file could not be saved. Please try again.');
      }

      const row = {
        id,
        title: String(body.title || '').trim(),
        description: String(body.description || '').trim(),
        filename: D.safeFilename(body.filename),
        contentType: String(body.contentType || '').toLowerCase(),
        bytes: buf.length,
        tags: D.cleanTags(body.tags, knownIds),
        uploadedBy: who,
        uploadedAt: new Date().toISOString(),
        hidden: false,
      };
      try {
        await writeIndex(index, list.concat([row]));
      } catch (err) {
        return fail(503, 'That file could not be saved. Please try again.');
      }
      return json(200, { ok: true, document: publicRow(row, true) });
    }

    if (action === 'edit' || action === 'delete' || action === 'restore' || action === 'purge') {
      const id = String(body.id || '');
      if (!id) return fail(400, 'No document was named.');

      let list;
      try {
        list = await readIndex(index);
      } catch (err) {
        return fail(503, 'Documents could not be saved right now. Please try again.');
      }
      const at = list.map((d) => d && d.id).indexOf(id);
      if (at === -1) return fail(404, 'That document is not available.');

      if (action === 'edit') {
        const merged = {
          title: body.title,
          description: body.description,
          filename: list[at].filename,     // the file itself is not being replaced
          tags: body.tags,
        };
        const problem = D.metaProblem(merged, knownIds);
        if (problem) return fail(400, problem);
        list[at] = Object.assign({}, list[at], {
          title: String(body.title || '').trim(),
          description: String(body.description || '').trim(),
          tags: D.cleanTags(body.tags, knownIds),
        });
      } else if (action === 'delete') {
        /* SOFT. Jay, 7 Aug: hide, do not destroy. A misclick at 8am on the
           Saturday has no undo otherwise. */
        list[at] = Object.assign({}, list[at], { hidden: true });
      } else if (action === 'restore') {
        list[at] = Object.assign({}, list[at], { hidden: false });
      } else {
        /* PURGE — the irreversible one, and a SEPARATE deliberate action from
           delete. The typed confirmation lives in the panel, the way Simulate
           and Reset already do. The bytes go first here too: an index row
           removed before its blob leaves a file nothing can ever reach or
           name again. */
        try {
          await files.delete(id);
        } catch (err) {
          /* A missing blob is not a reason to refuse to tidy the row. */
        }
        list.splice(at, 1);
      }

      try {
        await writeIndex(index, list);
      } catch (err) {
        return fail(503, 'That change could not be saved. Please try again.');
      }
      return json(200, { ok: true });
    }

    return fail(400, 'Unknown action.');
  } catch (err) {
    /* Never leak an internal message to a caller. */
    return fail(500, 'Something went wrong. Please try again.');
  }
};
