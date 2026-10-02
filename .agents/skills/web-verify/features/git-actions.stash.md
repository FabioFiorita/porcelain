---
route: /
selectors:
  - "Git actions"
  - "Message"
  - "Stash changes"
  - "succeeded"
  - "Stash"
  - "Pop stash"
tests:
  - apps/web/spec/integration/git-actions-stash.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.stash

## What it is

Stashing sets the changes aside and popping the stash brings them back, while popping over a file changed since is refused with what Git said and keeps the stash.

## How a user reaches it

- Git actions → Stash changes → Stash changes, then Git actions → Pop stash → Pop stash

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Stashing sets the changes aside and popping the stash brings them back

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Journey stash"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: the text “succeeded” shows.
5. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Stash changes” is gone.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: the combobox “Stash” reads /Journey stash/.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`
   Look for: the text “succeeded” shows.
9. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Pop stash” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Popping a stash over a file changed since is refused with what Git said and keeps the stash

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: the text “succeeded” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Stash changes” is gone.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`
   Look for: the alert reads /would be overwritten/.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-stash.test.tsx` (Browser Mode integration): stashing sets the changes aside and popping the stash brings them back; popping a stash over a file changed since is refused with what Git said and keeps the stash.
- The tests read back what the server kept through the kit: `server.changes()`, `server.gitStatus()`, `server.text()`.

## Gotchas

- None known.
