---
route: /
selectors:
  - "Commit"
  - "Commit model"
  - "Generate with AI"
  - "Message"
  - "Commit selected files"
  - "succeeded"
  - "Use groups"
  - "Commit groups in order"
  - "Look again"
  - "Commit changes"
  - "Edit"
tests:
  - apps/web/spec/integration/git-actions-draft-commit.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
  - POST /api/worktrees/:worktreeId/git/commit-draft
---

# git-actions.draft-commit

## What it is

With a coding CLI on the server the commit dialog drafts the message or the groups with the chosen model and commits what was drafted, while the server refuses a commit the worktree has moved past since the draft and a draft that leaves a selected file out.

## How a user reaches it

- Commit → Commit model → Generate with AI → Commit selected files, or Commit → Use groups → Commit groups in order

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. With a coding CLI the chosen model drafts the message, and the drafted commit becomes the newest

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the combobox “Commit model” is enabled; the combobox “Commit model” holds 'Haiku'.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the textbox “Message” holds drafted.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the text “succeeded” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Use groups drafts one commit per group, and committing lands them in order

Before driving, on the instance (the sample repository and project home are in the instance file):

- put the fake coding tool on the server PATH as `claude` (the disposable server has no coding CLI until then)
- commit everything in the sample repository as “Commit the sample change first”
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Use groups"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit groups in order"`
   Look for: the text “Commit <groups.length> · committed” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 3. A commit the worktree has moved past since the draft is refused, and a new draft must cover every selected file

Before driving, on the instance (the sample repository and project home are in the instance file):

- commit everything in the sample repository as “Commit the sample change first”
- write `README.md` in the sample repository
- write `README.md` in the sample repository
- write `LATER.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the combobox “Commit model” is enabled.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the textbox “Message” holds drafted.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the alert reads /changed since looked/i; the button “Look again” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Look again"`
   Look for: the text “LATER.md” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the dialog “Commit changes” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Edit"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role checkbox --name "LATER.md"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the dialog “Commit changes” is gone.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-draft-commit.test.tsx` (Browser Mode integration): with a coding CLI the chosen model drafts the message, and the drafted commit becomes the newest; Use groups drafts one commit per group, and committing lands them in order; a commit the worktree has moved past since the draft is refused, and a new draft must cover every selected file.
- The tests read back what the server kept through the kit: `server.changes()`, `server.commits()`.

## Gotchas

- The disposable server has no coding CLI until the fake one is put on its PATH, so Generate with AI is unavailable on a fresh instance.
