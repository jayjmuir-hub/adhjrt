/* tests/test-documents.js
   ------------------------------------------------------------------------
   Documents shared with managers (Aug 2026).
   Spec: claude/specs/spec-documents.md

   THE FEATURE ANSWERS ONE QUESTION AND EVERYTHING HERE SERVES IT:

       DOES A MANAGER OPENING /manager ON THE SATURDAY MORNING SEE THE
       CURRENT DOCUMENTS FOR THEIR OWN GROUP, AND NOBODY ELSE'S?

   ⚠️ THE RULES ARE DRIVEN, NOT GREPPED. `_documents.js` is deliberately
   dependency-free — it requires nothing, so this file can call it directly.
   That is the whole reason the split exists (same argument as `_password.js`):
   a test that needs `npm install` first is a test that eventually stops being
   run. `documents.js` itself CANNOT be loaded here, because it requires
   `_auth.js` which requires bcryptjs, so the checks on that file are
   necessarily textual — and this file says so rather than implying otherwise.

   ⚠️ ASSERTING THE ABSENCE OF THINGS IS NOT A TEST — the standing lesson from
   get-registrations.js going blank in production. So every negative check on
   documents.js below is paired with a positive one that names what it NEEDS.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const D = require(path.join(repoRoot(), 'netlify', 'functions', '_documents.js'));
const A = require(path.join(repoRoot(), 'netlify', 'functions', '_agegroups.js'));

const IDS = A.AGE_GROUPS.map((g) => g.id);

/* Invented fixtures only. Nothing here may ever be built from a real sheet
   row — the registration sheets hold children's names, dates of birth and
   medical notes, and this repo is public. */
const doc = (over) => Object.assign({
  id: 'd1', title: 'The draw', description: '', filename: 'draw.pdf',
  contentType: 'application/pdf', bytes: 1000, tags: ['*'],
  uploadedBy: 'An organiser', uploadedAt: '2026-08-07T09:00:00.000Z', hidden: false,
}, over || {});

const manager = (id) => ({ isOrganizer: false, ageGroupId: id });
const organiser = () => ({ isOrganizer: true, ageGroupId: '*' });

/* Real leading bytes for each family we accept. */
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);

function main() {

section('The size limit is the MEASURED one, in one place');
{
  eq('the cap is 4 MiB', D.MAX_FILE_BYTES, 4 * 1024 * 1024);

  /* ⚠️ THE CLIENT CAP AND THE SERVER CAP MUST BE THE SAME NUMBER, and this is
     asserted rather than trusted. A client cap HIGHER than the server's means
     the organiser picks a file, waits for the upload and bounces off a 400. A
     client cap LOWER means the page refuses something the server would have
     taken. Same argument as MIN_PASSWORD_LENGTH being asserted across the two
     dashboards. */
  const org = readRepo('Organizer.dc.html');
  const m = org.match(/MAX_DOC_BYTES\s*=\s*([0-9*\s]+);/);
  check('the organiser page carries its own copy of the cap', !!m);
  if (m) {
    // eslint-disable-next-line no-eval
    eq('…and it is the same number as the server’s', eval(m[1]), D.MAX_FILE_BYTES);
  }

  /* ⚠️ THE PLATFORM 413 HAS AN EMPTY BODY, so the page must check the size
     BEFORE posting — there is no server sentence to show at that size. This
     asserts the client actually does its own check rather than relying on the
     round trip. */
  check('the organiser page checks the size before posting',
    /\.size\s*>\s*MAX_DOC_BYTES/.test(org));
}

section('The type check reads the BYTES, not the name');
{
  eq('a real PDF passes', D.typeProblem('application/pdf', PDF), null);
  eq('a real PNG passes', D.typeProblem('image/png', PNG), null);
  eq('a real JPG passes', D.typeProblem('image/jpeg', JPG), null);
  eq('a real XLSX (a zip) passes',
    D.typeProblem('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ZIP), null);
  eq('a real DOCX (a zip) passes',
    D.typeProblem('application/vnd.openxmlformats-officedocument.wordprocessingml.document', ZIP), null);

  /* THE ONE THAT MATTERS: `draw.pdf` is a filename and anybody can call
     anything that. An executable declared as a PDF must be refused on its
     bytes — a check on the extension would pass this happily. */
  check('an executable renamed to .pdf is REFUSED',
    D.typeProblem('application/pdf', EXE) !== null);
  check('…and a PNG declared as a PDF is refused too',
    D.typeProblem('application/pdf', PNG) !== null);
  check('an unlisted type is refused even with honest bytes',
    D.typeProblem('application/x-msdownload', EXE) !== null);
  check('an empty buffer is refused rather than sniffed as anything',
    D.typeProblem('application/pdf', Buffer.alloc(0)) !== null);

  /* The allow-list is a list, not a rule — assert its exact membership so a
     sixth type cannot arrive unnoticed. */
  eq('exactly five types are allowed', Object.keys(D.ALLOWED_TYPES).length, 5);
  check('no type allows a bare octet-stream', !D.ALLOWED_TYPES['application/octet-stream']);
}

section('⚠️ The tag filter — swept across ALL FIFTEEN groups, both directions');
{
  eq('the sweep covers fifteen groups', IDS.length, 15);

  /* Sweep the WHOLE list, not the head of it. A loop that stopped at the
     first group would pass on a filter that only ever answered about u6. */
  let everyoneSeesStar = true, ownGroupSeen = true, otherGroupHidden = true;
  IDS.forEach((id) => {
    if (!D.tagsAllow(['*'], id)) everyoneSeesStar = false;
    if (!D.tagsAllow([id], id)) ownGroupSeen = false;
    /* every OTHER group must be invisible to this one */
    IDS.forEach((other) => {
      if (other !== id && D.tagsAllow([other], id)) otherGroupHidden = false;
    });
  });
  check('every group sees a document tagged for everyone', everyoneSeesStar);
  check('every group sees a document tagged for itself', ownGroupSeen);
  check('⚠️ no group sees a document tagged only for another group', otherGroupHidden);

  check('an organiser (age group "*") sees a document tagged for one group',
    D.tagsAllow(['u12g'], '*'));
  check('a session with no age group sees nothing specific',
    !D.tagsAllow(['u12g'], ''));
  check('…but still sees a document tagged for everyone',
    D.tagsAllow(['*'], ''));
  check('an empty tag list is visible to nobody', !D.tagsAllow([], 'u12'));
  check('a missing tag list is visible to nobody', !D.tagsAllow(undefined, 'u12'));
}

section('⚠️ A soft-deleted document is refused BY THE READ PATH, not just absent from the list');
{
  /* These are DIFFERENT CLAIMS and only one of them is the guarantee. A
     manager who kept the URL must not still have a withdrawn file — that is
     exactly the failure the delete button exists to prevent. */
  const hidden = doc({ hidden: true, tags: ['*'] });
  check('a manager cannot read a hidden document', !D.canRead(hidden, manager('u12')));
  check('…even when its tags name their own group',
    !D.canRead(doc({ hidden: true, tags: ['u12'] }), manager('u12')));
  check('an organiser CAN still read it (it is their shelf)',
    D.canRead(hidden, organiser()));

  const list = [doc({ id: 'a', hidden: false }), doc({ id: 'b', hidden: true })];
  eq('the manager’s list omits it', D.visibleDocs(list, manager('u12')).length, 1);
  eq('the organiser’s default list omits it too',
    D.visibleDocs(list, organiser()).length, 1);
  eq('…and the organiser’s "show deleted" view includes it',
    D.visibleDocs(list, organiser(), { includeHidden: true }).length, 2);
}

section('The list is newest first, and filtered per session');
{
  const list = [
    doc({ id: 'old', uploadedAt: '2026-08-01T00:00:00.000Z', tags: ['*'] }),
    doc({ id: 'new', uploadedAt: '2026-08-06T00:00:00.000Z', tags: ['*'] }),
    doc({ id: 'mid', uploadedAt: '2026-08-03T00:00:00.000Z', tags: ['u16b'] }),
  ];
  const seen = D.visibleDocs(list, manager('u12')).map((d) => d.id);
  eq('a u12 manager sees only the two tagged for everyone', seen.length, 2);
  eq('…newest first', seen[0], 'new');
  eq('…oldest last', seen[1], 'old');
  eq('an organiser sees all three', D.visibleDocs(list, organiser()).length, 3);
  eq('a u16b manager sees theirs as well', D.visibleDocs(list, manager('u16b')).length, 3);
}

section('Tags are cleaned, and "*" wins outright');
{
  eq('an unknown id is dropped', D.cleanTags(['u12', 'nope'], IDS).join(','), 'u12');
  eq('duplicates collapse', D.cleanTags(['u12', 'u12'], IDS).join(','), 'u12');
  eq('the list is sorted so two identical selections store identically',
    D.cleanTags(['u9', 'u12'], IDS).join(','), D.cleanTags(['u12', 'u9'], IDS).join(','));
  /* ['*','u12'] has two readings that are the same set — keeping both stores a
     row that says something ambiguous for ever. */
  eq('"*" beats a mixed selection', D.cleanTags(['*', 'u12'], IDS).join(','), '*');
  eq('blanks are dropped', D.cleanTags(['', '  ', 'u12'], IDS).join(','), 'u12');
  eq('a non-array is empty, not a throw', D.cleanTags('u12', IDS).length, 0);

  /* Every real id must survive the cleaner, or a document could never be
     tagged for that group at all. Swept, not sampled. */
  let allSurvive = true;
  IDS.forEach((id) => { if (D.cleanTags([id], IDS).join(',') !== id) allSurvive = false; });
  check('all fifteen real ids survive cleaning', allSurvive);
}

section('⚠️ An empty tag selection is REFUSED, not silently treated as everyone');
{
  /* Defaulting a blank selection to "*" would publish to all fifteen groups
     because somebody forgot to tick a box — and the failure is SILENT,
     because the organiser's own shelf shows everything regardless of tags,
     so it looks right to the one person who could have caught it. */
  const base = { title: 'T', filename: 'f.pdf', tags: [] };
  check('no tags is refused', D.metaProblem(base, IDS) !== null);
  check('…and the message asks who it is for',
    /who this document is for/i.test(D.metaProblem(base, IDS) || ''));
  eq('a real tag passes', D.metaProblem(Object.assign({}, base, { tags: ['u12'] }), IDS), null);
  check('tags that are ALL unknown are refused, not accepted as empty',
    D.metaProblem(Object.assign({}, base, { tags: ['nope'] }), IDS) !== null);

  check('a missing title is refused', D.metaProblem({ filename: 'f.pdf', tags: ['*'] }, IDS) !== null);
  check('a blank title is refused', D.metaProblem({ title: '   ', filename: 'f.pdf', tags: ['*'] }, IDS) !== null);
  check('an over-long title is refused',
    D.metaProblem({ title: 'x'.repeat(D.MAX_TITLE + 1), filename: 'f.pdf', tags: ['*'] }, IDS) !== null);
  check('a missing filename is refused', D.metaProblem({ title: 'T', tags: ['*'] }, IDS) !== null);
}

section('The filename is sanitised before it can become a key or a header');
{
  check('a slash cannot choose its own blob key', D.safeFilename('a/b.pdf').indexOf('/') === -1);
  check('a quote cannot break out of a Content-Disposition header',
    D.safeFilename('a"b.pdf').indexOf('"') === -1);
  check('a newline cannot inject a header', D.safeFilename('a\r\nb.pdf').indexOf('\n') === -1);
  check('a backslash is removed', D.safeFilename('a\\b.pdf').indexOf('\\') === -1);
  eq('an ordinary name is left alone', D.safeFilename('The draw.pdf'), 'The draw.pdf');
  check('an empty name still yields something', D.safeFilename('').length > 0);
  check('a very long name is cut to the limit', D.safeFilename('x'.repeat(500)).length <= D.MAX_FILENAME);
}

section('documents.js — the door, and the split');
{
  const fn = readRepo('netlify/functions/documents.js');

  /* POSITIVE — what it NEEDS. The lesson from get-registrations.js: a file
     that only has "must not contain" checks can lose a require and still pass
     every one of them, then 500 in production. */
  check('it requires the verifier', /require\('\.\/_auth'\)/.test(fn));
  check('it requires the rules', /require\('\.\/_documents'\)/.test(fn));
  check('it requires the age-group list', /require\('\.\/_agegroups'\)/.test(fn));
  check('it verifies a bearer token', /verify\(getBearerToken\(event\)\)/.test(fn));
  check('it uses the shared canRead on the download path', /D\.canRead\(doc, sess\)/.test(fn));

  /* NEGATIVE — the split holds. A rule added to this file is a rule nothing
     can test, because it cannot be loaded without node_modules. */
  check('no copy of the tag rule lives here', !/function tagsAllow/.test(fn));
  check('no copy of the type check lives here', !/SIGNATURES\s*=/.test(fn));
  check('no second size constant', !/=\s*4\s*\*\s*1024\s*\*\s*1024/.test(fn));

  /* ⚠️ THE AGE GROUP COMES FROM THE TOKEN. Asserted as an ABSENCE of any body
     read, paired with the positive above — a handler that read
     `body.ageGroupId` would be the whole feature undone. */
  check('⚠️ it never reads an age group off the request', !/body\.ageGroupId/.test(fn));
  check('⚠️ it never reads a role off the request', !/body\.(role|isOrganizer)/.test(fn));

  /* ⚠️ A POSITION CHECK ON A STRING IS NOT A CHECK ON THE GUARD. The first
     version asserted that 'Please sign in.' appeared before the store was
     opened — which `if (!session && false) return …` satisfies perfectly,
     because the sentence never moved. Proven by injecting exactly that.
     The guard is now matched as a whole statement. Same lesson as the
     body-size test, where `MAX_BODY_BYTES` appearing before `JSON.parse` was
     satisfied by the const declaration at the top of the file. */
  check('a signed-out request is refused, by a real early return',
    /if \(!session\) return fail\(401, 'Please sign in\.'\);/.test(fn));
  check('…before the stores are opened',
    fn.search(/if \(!session\) return fail\(401/) < fn.indexOf("blobStore('docfiles')"));
  check('writing is organiser-only, in the function', /Only organisers can change documents/.test(fn));
  check('…and that gate sits before the body is parsed',
    fn.indexOf('Only organisers can change documents') < fn.indexOf('JSON.parse'));

  /* Fail soft on read, fail closed on write — the two must not be made
     consistent with each other. */
  check('the list fails SOFT, with a flag the page can read',
    /unavailable:\s*true/.test(fn));
  check('the upload fails CLOSED', /could not be saved/.test(fn));

  /* ⚠️ indexOf RETURNS -1, AND -1 IS LESS THAN EVERYTHING. The first version
     compared two indexOf results directly, so a fault that DELETED the file
     write passed the ordering check with flying colours — the very fault it
     existed to catch. Both anchors are asserted present first. */
  const iBytes = fn.indexOf('files.set(id, buf)');
  const iRow = fn.indexOf('writeIndex(index, list.concat');
  check('the file write is still there', iBytes > -1);
  check('the index write is still there', iRow > -1);
  check('the bytes are written before the index row', iBytes > -1 && iRow > -1 && iBytes < iRow);
  check('delete is soft', /hidden:\s*true/.test(fn));
  check('purge removes the row', /list\.splice\(at, 1\)/.test(fn));
  check('a hidden flag never reaches a manager', /if \(isOrganizer\) row\.hidden/.test(fn));
}

section('⚠️ Documents are never public, and never in the repo');
{
  const toml = readRepo('netlify.toml');
  check('nothing rewrites a public URL onto documents',
    !/documents/i.test(toml) || !/\[\[redirects\]\][\s\S]*documents/i.test(toml));

  /* ⚠️ THE SINGLE MOST EXPENSIVE MISTAKE AVAILABLE HERE. The repo root IS the
     deployed site, so an uploaded file committed to it is published — and a
     document containing a child's name cannot be un-published by deleting it
     later. Uploads go to Blobs and nowhere else. */
  const fn = readRepo('netlify/functions/documents.js');
  check('the function writes to Blobs, not the filesystem',
    /blobStore\('docfiles'\)/.test(fn) && !/require\('fs'\)/.test(fn));
  check('…and never writes a path', !/writeFileSync|createWriteStream/.test(fn));
}

section('The manager page lists documents and cannot change them');
{
  const mgr = readRepo('Manager.dc.html');
  check('there is a Documents tab', /Documents/.test(mgr));
  check('it lists through the data layer', /api\.listDocuments/.test(mgr));
  check('it can download', /api\.downloadDocument/.test(mgr));

  /* Read-only, asserted BY NAME rather than by hoping. The same pattern as
     "/manager reaches none of the accounts-admin actions". */
  ['uploadDocument', 'deleteDocument', 'restoreDocument', 'purgeDocument', 'editDocument']
    .forEach((f) => check('a manager cannot ' + f, mgr.indexOf('api.' + f) === -1));

  /* ⚠️ EMPTY AND BROKEN MUST NOT LOOK THE SAME — three times bitten in this
     codebase now (clubsUnavailable is the same lesson one level down). */
  check('the manager page says when there are none yet', /No documents yet/.test(mgr));
  check('…and says something DIFFERENT when it could not load',
    /could not load|Could not load/.test(mgr));
  check('…and the two are different sentences',
    (mgr.match(/No documents yet/) || [])[0] !== (mgr.match(/could not load/i) || [])[0]);

  /* ⚠️ TWO SENTENCES EXISTING IS NOT THE SAME AS THE RIGHT ONE SHOWING.
     A fault that dropped `!s.docsUnavailable` from docsEmpty left both
     sentences in the markup and passed every check above, while rendering
     "No documents yet" to a manager whose list simply failed to load — the
     exact conflation this section is about. The GUARD is asserted now, on
     both pages, not just the copy. */
  check('⚠️ the manager’s "none yet" is suppressed when the load failed',
    /docsEmpty: s\.docsLoaded && !s\.docsUnavailable/.test(mgr));
  check('⚠️ …and so is the organiser’s',
    /docsEmpty: s\.docsLoaded && !s\.docsUnavailable/.test(readRepo('Organizer.dc.html')));
}

section('The organiser page has the shelf');
{
  const org = readRepo('Organizer.dc.html');
  check('there is a Documents tab button', /showDocuments \}\}" style="\{\{ tabDocumentsStyle \}\}">Documents/.test(org));
  check('the panel is gated on isDocuments', /<sc-if value="\{\{ isDocuments \}\}"/.test(org));
  check('it can upload', /api\.uploadDocument/.test(org));
  check('it can soft-delete', /api\.deleteDocument/.test(org));
  check('it can restore', /api\.restoreDocument/.test(org));
  check('it can purge', /api\.purgeDocument/.test(org));

  /* ⚠️ PURGE IS THE IRREVERSIBLE ONE AND GETS THE TYPED CONFIRMATION, the way
     Simulate and Reset already do. Delete does NOT need it — that is the
     whole point of soft-delete. */
  check('purge asks for a typed confirmation', /docPurgeText/.test(org) && /purgeArmed/.test(org));
  /* ⚠️ THE TYPED WORD IS THE DOCUMENT'S OWN TITLE, not a fixed word like
     DELETE — a fixed word is muscle memory after the second time and stops
     being a check at all. Asserted on the comparison itself, because
     "there is a text box" would pass on a box nothing reads. */
  check('…and the typed word must equal that document’s title',
    /docPurgeText\.trim\(\) === String\(purgerow\.title/.test(org));
  /* ⚠️ AND DELETE DELIBERATELY HAS NO CONFIRMATION. That is the whole point
     of soft-delete: a dialog on a reversible action trains people to click
     through dialogs, which is exactly what makes the irreversible one
     dangerous. Asserted as the absence of a purge-style gate on delete. */
  check('…while soft delete goes straight through',
    /onDeleteDoc\(id\) \{ this\.docAction/.test(org));

  check('the shelf can show deleted rows', /showDeletedDocs|deleted=1|docsShowDeleted/.test(org));
  check('empty and broken are different sentences here too',
    /No documents yet/.test(org) && /could not load/i.test(org));
}

section('The tab bar keeps Jay’s order with Documents in it');
{
  /* The regroup shipped on 7 Aug with an order assertion in
     test-organizer-clubs.js pinning SEVEN tabs. Documents is the eighth and
     joins the list deliberately — that check exists so an eighth tab cannot
     slip in unnoticed, and this is the moment it is meant to fire. */
  const src = readRepo('Organizer.dc.html');
  const a = src.indexOf('<!-- tabs');
  const b = src.indexOf('<!-- 30 Jul:', a);
  const bar = src.slice(a, b).replace(/<!--[\s\S]*?-->/g, '');

  const ORDER = ['showClubs', 'showTeams', 'showPlayers',
                 'showTournament', 'showVenue', 'showRegistration', 'showDocuments',
                 'showAccounts'];
  const at = (h) => bar.indexOf('onClick="{{ ' + h + ' }}"');
  let ordered = true;
  for (let i = 1; i < ORDER.length; i++) if (at(ORDER[i]) < at(ORDER[i - 1])) ordered = false;
  check('all eight tabs are present', ORDER.every((h) => at(h) > -1));
  check('…in Jay’s order, Documents inside Tournament configuration', ordered);
  eq('there are exactly eight tabs', (bar.match(/onClick="\{\{ show/g) || []).length, 8);

  /* ⚠️ Jay placed Documents under Tournament configuration. A reasonable
     person would call this distribution rather than configuration — it is
     recorded as HIS placement, not derived, and must not be "corrected". */
  const cfg = bar.indexOf('Tournament configuration');
  const admin = bar.indexOf('Site admin');
  check('Documents sits in the Tournament configuration group',
    at('showDocuments') > cfg && at('showDocuments') < admin);
}

section('The data layer exports everything the pages call');
{
  /* This sweep is why the two dead password features were caught. A missing
     data-layer function is not a build error, not a visible crash, and not
     obvious in review — the dialog just does nothing. */
  /* ⚠️ THE CHECK IS "IS THIS NAME EXPORTED", NOT "IS IT DECLARED HERE".
     The first version demanded `export function X` and failed on
     organizer-data.js — correctly reporting a problem that did not exist,
     because listDocuments and downloadDocument are RE-EXPORTED from
     scores-data.js on purpose (/manager reads that file only, and a second
     copy would be a second copy of the rules). A test that dictates the
     shape of an export rather than its presence pushes the code towards
     duplication, which is the opposite of what this repo needs. */
  const exportsName = (src, f) =>
    new RegExp('export\\s+(async\\s+)?function\\s+' + f + '\\b').test(src) ||
    new RegExp('export\\s*\\{[^}]*\\b' + f + '\\b[^}]*\\}').test(src);

  const od = readRepo('organizer-data.js');
  ['listDocuments', 'uploadDocument', 'downloadDocument', 'editDocument',
   'deleteDocument', 'restoreDocument', 'purgeDocument']
    .forEach((f) => check('organizer-data exports ' + f, exportsName(od, f)));

  const sd = readRepo('scores-data.js');
  ['listDocuments', 'downloadDocument']
    .forEach((f) => check('scores-data exports ' + f + ' (for /manager)', exportsName(sd, f)));

  /* And the re-export is asserted as a re-export, so nobody "helpfully"
     pastes a second implementation into organizer-data.js later. */
  check('the two shared readers are re-exported, not re-implemented',
    /export \{ listDocuments, downloadDocument \} from '\.\/scores-data\.js'/.test(od));
  check('…so organizer-data has no second copy of the download plumbing',
    !/createObjectURL/.test(od));
}

summary('test-documents.js');
}

main();
