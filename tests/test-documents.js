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

section('⚠️ Every loop uses the attributes the ENGINE understands');
{
  /* ⚠️ THIS SECTION EXISTS BECAUSE THE DOCUMENTS TAB SHIPPED TO PRODUCTION
     RENDERING NOTHING, AND EVERY ONE OF THE 121 CHECKS IN THIS FILE PASSED.
     Jay found it in about a minute; the suite could not have found it ever.

     The markup was written as:

         <sc-for value="{{ docRows }}" alias="row">

     `value` and `alias` are INVENTED. Every working loop in this repo uses
     `list` and `as`. The engine binds nothing, renders nothing, and reports
     NO ERROR ANYWHERE — so the tab drew its heading, its upload form and a
     tab badge reading "Documents (2)", proving the upload and the list both
     worked perfectly, above a completely empty list. The count comes from
     state; the rows come from the loop.

     Why nothing caught it: every check on the panel read the SOURCE for a
     handler name or a sentence, and all of those were present. Source
     presence is not rendering. This is the same family as the `{{ X }}`
     binding trap and the dead `api.X` calls — a mistake that is not a build
     error, not a runtime crash, and not visible in review.

     So the check is REPO-WIDE and mechanical, not scoped to documents: the
     next person to invent an attribute gets caught on any page. */
  const PAGES = ['Organizer.dc.html', 'Manager.dc.html', 'Quins JRT.dc.html',
                 'Scores & Standings.dc.html', 'Signin.dc.html', 'Club.dc.html'];

  let loops = 0, ifs = 0;
  PAGES.forEach((f) => {
    /* ⚠️ SCRIPT BLOCKS AND COMMENTS ARE BOTH STRIPPED, AND BOTH ARE NEEDED.
       The first version stripped HTML comments only and immediately reported a
       bare `<sc-if>` on the homepage — which is a sentence inside a /* *​/ JS
       comment explaining why the menu panel is inside one. A check that
       matches prose about the code is not a check on the code. That is the
       THIRD time this trap has fired in a single day's work on this repo, so:
       `sc-for` and `sc-if` only ever exist in MARKUP, so everything between
       <script> tags goes before anything is counted. */
    const src = readRepo(f)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    (src.match(/<sc-for\b[^>]*>/g) || []).forEach((tag) => {
      loops++;
      check(`${f}: a loop binds its list with list= — ${tag.slice(0, 52)}`,
        /\blist="\{\{/.test(tag), tag);
      check(`${f}: …and names its item with as= — ${tag.slice(0, 52)}`,
        /\bas="/.test(tag), tag);
      /* Positive AND negative: the invented pair by name, so a future
         `value=`/`alias=` fails loudly rather than silently drawing nothing. */
      check(`${f}: …and uses neither value= nor alias= — ${tag.slice(0, 52)}`,
        !/\bvalue="/.test(tag) && !/\balias="/.test(tag), tag);
    });

    (src.match(/<sc-if\b[^>]*>/g) || []).forEach((tag) => {
      ifs++;
      /* sc-if genuinely IS value= — the two tags do not agree with each
         other, which is precisely why the wrong one is so easy to reach for.
         Asserted so nobody "makes them consistent" and breaks every
         conditional on the site. */
      check(`${f}: a conditional binds with value= — ${tag.slice(0, 52)}`,
        /\bvalue="\{\{/.test(tag), tag);
    });
  });

  /* A sweep over nothing passes for ever. */
  check('the loop sweep actually found loops', loops > 30, String(loops));
  check('the conditional sweep actually found conditionals', ifs > 30, String(ifs));

  /* And the documents loops specifically, by name, so a regression reads
     unmistakably instead of as one of a hundred. */
  const org = readRepo('Organizer.dc.html');
  check('the tag chips loop is bound', /<sc-for list="\{\{ docTagChips \}\}" as="chip"/.test(org));
  check('the organiser document rows loop is bound', /<sc-for list="\{\{ docRows \}\}" as="row"/.test(org));
  check('the manager document rows loop is bound',
    /<sc-for list="\{\{ docRows \}\}" as="row"/.test(readRepo('Manager.dc.html')));
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

section('⚠️ Every tab panel is a SIBLING, not nested inside another tab');
{
  /* ⚠️ THIS SHIPPED BROKEN TOO, 7 Aug 2026 — the second render bug in one
     feature, from the same root cause: the panel was inserted BY LINE NUMBER
     and landed before the wrong closing tag, so /manager's Documents panel
     sat INSIDE <sc-if value="{{ isRegistrations }}">.

     It could therefore only render while the Registrations tab was open —
     which is never true when Documents is selected. Tag balance stayed
     EQUAL, `node --check` passed, every source check passed, and the tab
     drew nothing. Jay found it by uploading a document and looking.

     A panel nested inside another panel's conditional is unreachable by
     construction. That is checkable, so it is checked — on both dashboards,
     for every tab, by structure rather than by eye. */
  const PANELS = {
    'Manager.dc.html': ['isFixtures', 'isResults', 'isTables', 'isDraw',
                        'isRegistrations', 'isDocuments'],
    'Organizer.dc.html': ['isTeams', 'isPlayers', 'isAccounts', 'isVenue',
                          'isRegistration', 'isTournament', 'isDocuments', 'isClubs'],
  };

  Object.keys(PANELS).forEach((file) => {
    const src = readRepo(file).replace(/<!--[\s\S]*?-->/g, '');
    const enclosers = (tab) => {
      const at = src.indexOf('<sc-if value="{{ ' + tab + ' }}"');
      if (at < 0) return null;
      const open = [];
      const re = /<(sc-if|sc-for)\b[^>]*>|<\/(sc-if|sc-for)>/g;
      let m;
      while ((m = re.exec(src)) && m.index < at) {
        if (m[0].charAt(1) === '/') open.pop(); else open.push(m[0]);
      }
      return open.map((t) => (t.match(/\{\{ ([\w.]+)/) || [])[1]).filter(Boolean);
    };

    const depths = {};
    PANELS[file].forEach((tab) => {
      const enc = enclosers(tab);
      check(`${file}: the ${tab} panel exists`, enc !== null);
      if (enc === null) return;
      depths[tab] = enc.length;
      /* The decisive one: no tab panel may sit inside ANOTHER tab's flag. */
      const insideAnotherTab = enc.filter((e) => PANELS[file].indexOf(e) > -1);
      check(`⚠️ ${file}: ${tab} is not nested inside another tab's panel`,
        insideAnotherTab.length === 0, 'inside ' + insideAnotherTab.join(','));
    });

    /* And they must all be at the SAME depth — a panel one level deeper is
       inside something, even if that something is not itself a tab flag. */
    const seen = Object.keys(depths).map((t) => depths[t]);
    const allSame = seen.every((d) => d === seen[0]);
    check(`${file}: every tab panel sits at the same nesting depth`, allSame,
      JSON.stringify(depths));
  });
}

section('The organiser page has the shelf');
{
  const org = readRepo('Organizer.dc.html');
  check('there is a Documents tab button', /showDocuments \}\}" style="\{\{ tabDocumentsStyle \}\}">Documents/.test(org));
  check('the panel is gated on isDocuments', /<sc-if value="\{\{ isDocuments \}\}"/.test(org));
  check('it can upload', /api\.uploadDocument/.test(org));
  check('it can change sharing on an existing document', /api\.editDocument/.test(org));
  check('…from a button on the row', /onClick="\{\{ row\.onEditRow \}\}"/.test(org));
  check('…opening an editor inside that row', /<sc-if value="\{\{ row\.isEditing \}\}"/.test(org));
  check('…with its own tag chips', /<sc-for list="\{\{ docEditTagChips \}\}" as="echip"/.test(org));
  /* ⚠️ THE EDITOR MUST NOT TOUCH THE FILE. The bytes, the upload date and the
     uploader are the record of what was shared and when; a re-share that
     quietly rewrote them would destroy that. Asserted as the absence of a
     file input inside the edit block. */
  check('⚠️ the editor cannot replace the file',
    !/isEditing[\s\S]{0,1600}type="file"/.test(org));
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
  /* ⚠️ DELETE ASKS FIRST TOO, SINCE 7 AUG 2026 — Jay: "a confirm delete
     instead of just push delete and its gone". The original had none, on the
     argument that a dialog on a REVERSIBLE action only trains people to click
     through dialogs. That was wrong here: the row VANISHES from the default
     list, so it reads as destructive whether or not it is, and nothing said
     it could be brought back.

     ⚠️ ASSERTED ON THE SENTENCE, NOT JUST THE DIALOG. "There is a confirm"
     would pass on a bare "Are you sure?", which is pure friction — the whole
     value is telling the organiser it is recoverable and how. */
  /* "confirmModal APPEARS SOMEWHERE IN THE METHOD" IS NOT A CHECK ON THE GATE.
     The first version matched confirmModal within 400 characters of the method
     opening, which an injected docAction(...) + return at the very top
     satisfies perfectly -- the dialog code is still there, just unreachable.
     Proven by injecting exactly that. So the METHOD BODY is sliced out and the
     ORDER asserted: nothing may delete before the question is asked. */
  const delAt = org.indexOf('  onDeleteDoc(id) {');
  const delBody = delAt > -1 ? org.slice(delAt, org.indexOf('\n  }', delAt)) : '';
  check('the delete handler was found', delBody.length > 0);
  check('deleting asks first', delBody.indexOf('confirmModal(') > -1);
  check('nothing deletes BEFORE the question is asked',
    delBody.indexOf('confirmModal(') > -1 &&
    delBody.indexOf('confirmModal(') < delBody.indexOf('docAction('));
  check('…and the dialog names the document', /Hide "' \+ title \+ '"|Hide \\"/.test(org) || /'Hide "' \+ title/.test(org));
  check('…and says it can be restored', /Show deleted\u201d and you can restore it|can restore it at any time/.test(org));
  check('…and still calls the SOFT delete, not the purge',
    /okLabel: 'Hide it'/.test(org) && /deleteDocument, id/.test(org));

  /* Purge stays the heavier one: it keeps the TYPED confirmation on top of a
     dialog, so the two are not the same weight. If they ever become the same,
     the typed step has stopped meaning anything. */
  check('⚠️ purge is still heavier than delete — typed, not just a dialog',
    /purgeArmed/.test(org));

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

  /* ⚠️ THE REVERSE SWEEP — EVERY EXPORTED DOCUMENT FUNCTION MUST BE CALLED.
     Added 7 Aug 2026 because editDocument shipped to production fully built,
     all the way down (documents.js action:'edit', organizer-data's
     editDocument) with NO BUTTON ANYWHERE. Dead published code on a public
     repo, and the only way to re-share a document was delete and re-upload,
     which loses the upload date.

     The existing sweep in test-accounts.js runs the OTHER way — every api.X
     the page CALLS must be exported — and it is what caught the two dead
     password features. It cannot catch this, because nothing was calling
     anything. An export with no caller is the mirror image and needs its own
     check: this repo has now shipped that failure in BOTH directions.

     ⚠️ The check is "called by some page", not "called by /organizer" —
     listDocuments and downloadDocument are reached from /manager. */
  const org = readRepo('Organizer.dc.html');
  const mgr = readRepo('Manager.dc.html');
  ['listDocuments', 'uploadDocument', 'downloadDocument', 'editDocument',
   'deleteDocument', 'restoreDocument', 'purgeDocument'].forEach((f) => {
    check('⚠️ ' + f + ' is actually CALLED by a page, not just exported',
      org.indexOf('api.' + f) > -1 || mgr.indexOf('api.' + f) > -1,
      'exported and unreachable — dead code, published');
  });

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
