# Clubs do not get sign-in accounts or a club page

**Ruling.** There is no `club` role, no `/club` page, no signed-in club declaration. Clubs register through the public forms. A design for one Google-only account per club, claimed once by a named youth manager, was built on a branch, unmerged. Do not re-propose it without reopening the decision with the maintainer. If reopened, two choices stand: the club stayed out of the session token, and when two saves compete, the latest by timestamp wins, never the later row in storage order.

**Why.** The maintainer decided against it: a login into their club's full player registrations for about twenty people outside the committee, medical notes and parent contacts included, resting on a normalised club-name match where a collision or wrong alias shows one club another's children.

**Against, and why it lost.** A club cannot see or correct its declaration, and nobody there can check that team and player registrations agree. Those gaps lost to the cost of a new role, a new children's-data audience, and an email claim handing a club to whoever types the address.

**Where in the code.** Not in code; the work exists only as a local branch outside the repo, enforced by `claude/decisions/2026-09-10-documentation-cut.md` (bundle before the cutover).
