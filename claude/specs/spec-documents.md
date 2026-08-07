# Spec — Documents shared with managers

**Status: APPROVED TO BUILD, 7 August 2026. Still no code.** Written 5 Aug before
any code, parked by Jay the same day, unparked by Jay on 7 Aug when he asked for
a Documents tab in `/organizer`'s Tournament configuration group.

Jay, 5 Aug: *"we need a documents section in the manager and organizer view,
organizers would have the option to share documents with managers."*
Jay, 7 Aug: *"add a documents tab to tournament configuration."*

⚠️ **"ADD A DOCUMENTS TAB" IS NOT A TAB-BAR CHANGE, AND THAT IS WORTH SAYING
FIRST.** The button is ten minutes; everything behind it is four commits, a new
Blobs store, a new function and a new test file. **A tab that does nothing must
not ship** — on this site the repo root IS the deployed page, so dead UI is
published UI.

Two decisions were taken up front, by Jay, and they shape everything below:

- **Documents are TAGGED BY AGE GROUP.** A document is either for everyone or
  for specific groups, and a manager sees only what applies to them.
- **Files are UPLOADED IN THE BROWSER and stored in Netlify Blobs.** Not Drive
  links.

---

## 0. The four open questions are ANSWERED (7 August 2026)

These gated the build and no longer do. **Recorded here rather than in a chat,
because a decision that lives only in a conversation gets re-litigated by the
next session.**

| # | Question | Jay's answer, 7 Aug |
|---|---|---|
| 1 | Documents on the match-day app? | **`/manager` only in v1.** Not `/app`. |
| 2 | Who is "everyone"? | **Every signed-in manager, plus organisers. Never public.** |
| 3 | After the tournament? | **Delete by hand.** No automatic clear-down. |
| 4 | Delete confirmation? | **Soft-delete — hide, do not destroy.** |

**The arguments AGAINST each choice, because somebody will make them again:**

- **1 — `/app` is the thing actually open on a touchline.** A manager wanting the
  draw on Saturday morning has to leave the PWA for the dashboard. That is a real
  cost and it was accepted knowingly: `/app`'s service worker is network-first
  and never caches `/.netlify/functions/`, so an offline document is deliberate
  work, not a free extra. ⚠️ **If this is revisited, it is a fifth surface and a
  new offline story — not "the same list again".**
- **2 — a code of conduct is something a parent might reasonably want.** Rejected
  because `/rules` already exists for public-facing documents and is indexable.
  ⚠️ **Adding a public mode later means a second permission mode and a public
  URL; it is not a flag.**
- **3 — the 2027 organiser inherits 2026's shelf if nobody remembers.** Accepted:
  an irreversible automatic delete is a new class of risk on a site that has none
  today. **Clearing the shelf is now a post-tournament job and belongs in
  `claude/parked-requests.md` when the feature ships.**
- **4 — soft-delete means the bytes linger in storage.** Accepted: the tournament
  is a single weekend and a misclick at 8am on the Saturday has no undo
  otherwise. It costs organisers a "show deleted" view.

---

## 1. What this is for

An organiser has a PDF — the draw, a pitch map, a code of conduct, a first-aid
sheet — and needs the fifteen age-group managers to have it. Today that is a
WhatsApp message, which means the file lives in fifteen phones, the newest
version is whichever one somebody scrolled to, and a manager who joined last
week has none of it.

The tournament is one weekend. **The failure this prevents is a manager working
from last month's draw on the morning**, not the inconvenience of attaching a
file.

⚠️ **This is a distribution problem, not a storage problem.** The measure of
success is that a manager opening `/manager` on the Saturday morning sees the
current documents for their group without asking anybody. Anything that does not
serve that is out of scope for v1.

---

## 2. What a manager sees, and what an organiser sees

**`/manager` — a new Documents tab.** A list, newest first: title, a short
description, the file type and size, who posted it, when. One button: download.
Nothing else. A manager cannot upload, rename or delete.

**`/organizer` — the same list, plus the shelf.** Upload, edit the title or
tags, delete. An organiser sees EVERY document regardless of tags, always, with
the tags shown on each row — an organiser filtered out of their own back office
is a support call.

⚠️ **The manager's list must say when it is empty and when it is broken, and
they must not look the same.** "No documents yet" and "could not load documents"
are different sentences, and this codebase has been bitten by conflating them
three times (`clubsUnavailable` on the Clubs tab is the same lesson).

### Where the tab sits (7 August 2026)

`/organizer`'s tab bar is being regrouped in the same piece of work — Jay's
order, three labelled groups:

| group | tabs |
|---|---|
| **REGISTRATIONS** | Clubs, Teams, Players |
| **TOURNAMENT CONFIGURATION** | Tournament, Venue & days, Registration, **Documents** |
| **SITE ADMIN** | Accounts |

⚠️ **Teams stays the default tab.** Clubs is leftmost; leftmost and default are
separate decisions and Jay chose to keep them apart.

⚠️ **NOTHING ASSERTS TAB ORDER TODAY.** The regroup ships with an order
assertion and a fault that shuffles it, or the next edit to that block silently
undoes it. `test-organizer-clubs.js` currently pins only that a Clubs BUTTON
exists, by regex, and that regex survives a reorder — so it cannot catch this.

⚠️ **"Documents" under *Tournament configuration* is Jay's placement and is
recorded as his, not derived.** A reasonable person would call this
distribution rather than configuration. Do not "correct" it.

---

## 3. Tagging, and the one rule that matters

A document carries a list of age-group ids, or the single value `*`.

- `*` means every signed-in manager, plus organisers. **It does not mean the
  public** — answer 2 above.
- `['u12','u12g','u13']` means those three groups only.

**A manager sees a document when its tags include `*` OR include their own age
group.** An organiser's session carries `ageGroupId: '*'`, which is the same
sentinel `_auth.js` already uses for the all-groups manager — so the filter is
one line and reuses machinery that is already tested.

⚠️ **THE FILTER MUST RUN SERVER-SIDE, AND THE FILE MUST NOT BE REACHABLE
WITHOUT IT.** A client-side filter is not a filter — that is written down in
this project already, about the pool dropdown, where narrowing the options in
the page did nothing because the server never validated the value. If documents
are served as static URLs, the tags are decoration: anybody with the URL has the
file regardless of tags. **The download must go through a function that checks
the session against the tags every time.**

⚠️ **And weigh what is actually behind the door.** A draw and a pitch map are
not sensitive. If a v1 ships where tags are advisory, say so out loud rather
than implying a protection that is not there — the club-form lesson. The reason
to do it properly is not secrecy, it is that **a manager who sees fifteen
groups' documents cannot find their own.**

---

## 4. Storage

**Netlify Blobs, two stores, and the split is deliberate.**

| store | key | holds |
|---|---|---|
| `documents` | `list` | the INDEX: an array of metadata records |
| `docfiles` | `<id>` | the file bytes, one key per document |

⚠️ **The index is a single blob rewritten whole, exactly like the accounts
list — so it has the same race.** Two organisers uploading at the same moment
both read the list, both write it back, and one upload vanishes with no error.
That is the July results bug and the reason `_signins.js` exists as its own
per-key store.

For fifteen managers and a handful of organisers this is **tolerable but not
free**, and the decision must be taken knowingly:

- **Accept it in v1** (recommended). Uploads are rare, deliberate, and done by
  two or three people who are not usually working at the same second. Document
  the race where the code is, as `_auth.js` does.
- **Or** give each document its own metadata key and list by prefix, which
  removes the race entirely and costs a listing call per page load.

**The file bytes are a separate key per document from the start**, whichever is
chosen — that part is not negotiable, because putting file bytes in a
rewritten-whole blob makes every upload rewrite every file.

### ⚠️ Blobs is NOT the constraint — measured 7 Aug 2026

Netlify's own limits, read off their docs rather than assumed:

| | |
|---|---|
| one object | **5 GB** |
| object metadata | 2 KB |
| store name | 64 bytes, no `/` or `:` |
| object key | 600 bytes, cannot start with `/` |

**Storage could take anything we can get to it.** The ceiling is entirely the
upload path — see §5.

---

## 5. ⚠️ Upload: THE 10 MB IN THE FIRST DRAFT OF THIS SPEC IS WRONG

**Corrected 7 August 2026, and the correction has a hole in it that must be
closed by measurement rather than by another assumption.**

**What was checked, and what it actually says:**

- **Netlify publishes NO request-body limit for synchronous functions.** Not in
  the functions overview, the API reference, the configuration page or
  usage-and-billing. The only size figure in the API reference is for
  *streaming*: *"Streaming functions have a 60-second execution limit and a
  20 MB response size limit"* — a different mechanism and a RESPONSE, not a
  request.
- **Netlify's own staff defer to AWS.** On the support thread asking exactly
  this question, Scott from Netlify: *"I'd be inclined to go with the AWS values
  as nothing else springs to mind RE: a limitation."* AWS Lambda's synchronous
  invocation payload cap is **6 MB**.
- **Base64 spends a third of it.** A file posted inside JSON inflates by ~33%,
  so a 6 MB body carries roughly **4.4 MB of actual file**.

⚠️ **SO 6 MB IS INFERRED FROM AWS, NOT STATED BY NETLIFY, AND THIS SPEC WILL
NOT WRITE AN ASSUMED NUMBER DOWN AS FACT A SECOND TIME.** The first draft's
10 MB was exactly that mistake, and it is the same shape as the "env vars need
no deploy" claim that survived a week.

**MEASURE IT BEFORE BUILDING THE PICKER.** A scratch endpoint on `Compare`
(**0 credits** — branch deploys are free) posting bodies of increasing size
until it 413s gives the real cliff in about ten minutes. ⚠️ **Take a reading
that FAILS as well as one that passes** — a size that succeeds proves nothing
about where the edge is, and this project has shipped a "verified" claim with
no before-reading before.

**Until measured, design to 4 MB and SAY SO IN THE PICKER.** Promising 10 and
failing at 5 is worse than offering 4 and working.

| limit | value | why |
|---|---|---|
| max size | **4 MB pending measurement** | the function request body, not storage. See above. |
| types | **PDF, PNG, JPG, XLSX, DOCX** | everything a tournament actually sends. An allow-list, not a block-list. |
| count | no hard cap | fifteen groups, one weekend |

⚠️ **THE TYPE CHECK MUST BE ON THE BYTES, NOT THE FILENAME.** `draw.pdf` is a
filename; anybody can call anything that. The check belongs server-side on the
content type and, ideally, the file's magic bytes. A client-side accept
attribute is a convenience for the file picker and nothing more.

⚠️ **The repo is public and its root is the deployed site.** Uploaded files must
NEVER be written into the repo — they go to Blobs. This is the single most
expensive mistake available here: a document containing a child's name committed
to a public repository cannot be un-published by deleting it.

---

## 6. Permissions, stated as rules

1. **Upload, edit, delete: organiser only**, enforced by `requireOrganizer` in
   the function, not by hiding the button.
2. **Download: any signed-in session whose age group matches the tags.**
3. **No public access at all.** A signed-out request gets a 401, not a file.
   Confirmed by answer 2 — `*` never means the public.
4. **The session's age group comes from the verified token**, never from the
   request. This is the rule `my-account.js` was built on and it is the only
   thing between "download my group's documents" and "download anybody's".

### Deleting — SOFT, decided 7 Aug 2026

**Delete marks the index row hidden. The bytes stay until an explicit purge.**

- A hidden document is invisible to managers immediately — that is the whole
  point of the button and it must not be weakened into "eventually".
- Organisers get a **show deleted** view and a restore. Without it, soft-delete
  is just a delete that also wastes storage.
- ⚠️ **The purge is a SEPARATE, deliberate action** and it is the irreversible
  one. It gets the typed confirmation naming the document, the way Simulate and
  Reset already do.
- ⚠️ **"Hidden" must be checked SERVER-SIDE in the download path too**, or a
  manager who kept the URL still has the file after it was withdrawn — which is
  the exact failure the button exists to prevent. A filter applied only to the
  list is not a filter.

---

## 7. What happens when things go wrong

- **Blob store unreachable on read:** the list shows "could not load documents,
  try again" — FAIL SOFT. Documents are useful; they are not the tournament, and
  a documents outage must not take out a manager's fixtures and scoring.
- **Blob store unreachable on write:** the upload FAILS CLOSED and says so. A
  silent success that stored nothing is worse than a refusal.
- **A file's bytes are missing but its index row exists:** the row renders with
  the download disabled and a plain "file missing" note. This state is reachable
  through a partial delete, and pretending it cannot happen is how you get a
  button that does nothing.

---

## 8. Deliberately NOT in v1

Each of these is a real idea, recorded so it is not re-proposed as new:

- **Documents on `/app`.** Answer 1 above — the argument for it is good and it
  is still a no for v1.
- **Public documents.** Answer 2 above. `/rules` is the public surface.
- **Automatic clear-down.** Answer 3 above.
- **Versioning.** Replacing a document keeps no history. If a v2 wants it, the
  file store is already per-key and can take `<id>/v2`.
- **Read receipts.** "Which managers have opened the draw" is genuinely useful
  the week before a tournament and is a whole feature; it needs its own store,
  for the same racing reason as sign-in stamps.
- **Manager upload.** Team sheets going the other way is a different feature
  with a different permission model.
- **Notifications.** No email on upload in v1. If it is added, it is fifteen
  emails per document and it needs an unsubscribe story.
- **Folders.** Fifteen groups and a handful of documents do not need a tree.

---

## 9. Testing, before it is written

The suite gets a `tests/test-documents.js` in the same commit as the feature —
not after — and it must include, at minimum:

- the tag filter, **driven** rather than grepped, swept across all fifteen age
  groups and both directions (a manager sees theirs; a manager does NOT see
  another group's). ⚠️ **Sweep the whole list, not the head of it** — the
  club-count bug and the `test-organizer-clubs.js` design are both about
  exactly this.
- the download function refusing a signed-out request, and refusing a
  mismatched group, with the session forged in the request body to prove the
  token is what is trusted.
- **a soft-deleted document refused BY THE DOWNLOAD PATH**, not merely absent
  from the list — the two are different claims and only one of them is the
  guarantee.
- upload refused for a non-organiser session.
- the type check refusing a renamed file.
- the "empty" and "could not load" states asserted as DIFFERENT things.
- fail-soft on read, fail-closed on write, each with its own injected fault.
- **the `/organizer` tab ORDER and the three group labels**, with a fault that
  shuffles them. Nothing guards this today.

⚠️ **And `_prove-registration.js`'s `NEEDED` list gets every new file in the
same commit.** Four times now a new module has been left out of it, and the
symptom is eight unrelated faults blamed on the wrong thing.

⚠️ **The baseline must MOVE.** `test-documents.js` is a new FILE, so the
prover's second number goes 32 → 33. If it stays put, the file is not running
and every fault it reports as caught proves nothing.

---

## 10. Rough shape of the work

**Five steps now, not four — the measurement is step 0 and it is not optional.**

0. **Measure the real request-body cliff** on `Compare`. 0 credits. Delete the
   scratch endpoint before anything is committed — the repo root is the served
   site.
1. `_documents.js` — the store, the index, the tag filter, the soft-delete flag.
   No UI. Tests first.
2. `documents.js` — the function: list, upload, download, delete, restore,
   purge. Permissions.
3. `/organizer` — the tab-bar regroup (three labelled groups, Clubs leftmost)
   **and** the Documents tab with the shelf. The regroup ships with its own
   order assertion.
4. `/manager` Documents tab — the list.

**ONE production deploy at the end, not five.** Steps 1 and 2 ship no
user-visible change. ⚠️ **Look at it on `compare--adhquins-jrt.netlify.app`
first — that is free; the production deploy is 15 credits.**
