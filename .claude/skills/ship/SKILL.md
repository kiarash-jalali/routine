---
name: ship
description: Verify, review, commit and open a pull request for the current rootine change. Run when the user types /ship or says the change is ready to ship.
disable-model-invocation: true
---

Ship the current work as a pull request. Stop and report at the first step that fails.

1. **Branch check.** If on `main`, create a branch named for the change (`feat/…`, `fix/…`,
   `chore/…`) before anything else. Never commit directly to `main`.
2. **Scope check.** Run `git status` and `git diff --stat`. If unrelated changes are mixed
   in, list them and ask which to include.
3. **Verify.** Run `npm run verify`. If it fails, fix the cause (not the test), then re-run.
   After two failed fix attempts, stop and show the error.
4. **Review.** Ask the `reviewer` subagent to review `git diff main...HEAD` plus uncommitted
   changes. Fix every "Must fix" item, then re-run `npm run verify`. Mention "Should fix"
   items to the user rather than silently skipping them.
5. **Commit.** Small, imperative commit message describing why, e.g.
   "Keep date-only tasks untimed in Check-in". Don't commit `.env*` or generated noise.
6. **Push and open a PR** with `gh pr create`. PR body: what changed, why, how it was
   verified (commands run, manual checks incl. Persian/RTL and offline if relevant), and any
   reviewer items left open.
7. Report the PR link and anything the user must test by hand (push notifications on a real
   device, installed-PWA behaviour).
