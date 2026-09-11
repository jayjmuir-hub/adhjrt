# Old deploys are deleted, and pruned at every landing

**Ruling.** Netlify keeps only the live production deploy, four production rollback targets and the newest `dev` build. Everything older is deleted with `tools/delete-old-deploys.ps1`, which the maintainer runs after every landing (`runbook-merge-dev-to-main.md`, step 8). Project visibility is unchanged: production, previews and `dev--` stay public.

**Why.** Every deploy keeps its own address and runs its own code against production's variables and stores. On 11 Sep 2026 (JRT-35), 551 old deploys answered. 335 of them predated the manager-signup rate limit (`c5df5fa`) while `MANAGER_INVITE_CODES` was set, so anyone could make unlimited invite-code guesses just by changing the hostname. Deleting them took every one to 404, while the six kept deploys, adhjrt.com and `dev--` stayed at 200.

**Against, and why it lost.**
- *Project visibility, "Previews: Private"* (Netlify login required): this closes new previews and `dev` builds for good, and team members get in without a password. It lost for now because the maintainer chose deletion, and because Netlify's docs do not say whether it covers old **production** deploys, which were the biggest group (243). It is still the stronger long-term fix, and it can be added on top of this.
- *A password on non-production deploys:* it applies to the team too, and Claude cannot type passwords, so previews could no longer be checked.
- *Rotating `MANAGER_INVITE_CODES`:* a variable only takes effect at deploy, so old deploys would keep their codes. This was not measured, and it is not relied on.
- *Deleting everything but the live deploy:* that removes one-click rollback entirely, so four recent targets are kept.
- *Against the ruling itself:* pruning is a manual step. Between landings, new previews and `dev` builds pile up and stay public, and a forgotten prune reopens the gap. Only four rollback targets survive each prune.

**Where in the code.**
- `tools/delete-old-deploys.ps1`. It is a dry run by default. It stops unless the live deploy and the `dev` target are found and kept, and it asks for the exact count before deleting. Its guards were fault-tested by hand on 11 Sep. It is not part of the node suite.
- The landing runbook's step 8.
- `RESTORE.md`, "every deploy keeps its own address", which is pinned by `test-doc-claims.js`.
