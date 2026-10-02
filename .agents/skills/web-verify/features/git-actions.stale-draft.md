---
route: /
selectors:
  - "Commit"
  - "Generate with AI"
  - "Message"
  - "Commit selected files"
  - "Look again"
  - "Amend last"
  - "Single commit"
  - "succeeded"
  - "Commit changes"
  - "README.md"
  - "Use groups"
  - "Commit groups in order"
tests:
  - apps/web/spec/integration/git-actions-stale-draft.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
  - POST /api/worktrees/:worktreeId/git/commit-draft
---

# git-actions.stale-draft

## What it is

A drafted message whose files no longer match what the dialog looked at is flagged as stale and blocks the commit until the dialog looks again or the message is generated again, so a commit never pairs a draft with files it did not describe.

## How a user reaches it

- Commit → Generate with AI → Commit selected files → Look again

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. A draft the worktree moved past is refused, and after looking again the dialog says it is stale until it is generated again

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the textbox “Message” holds drafted.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the alert reads /changed since looked/i.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Look again"`
   Look for: the text shows; the button “Commit selected files” is disabled.
5. `.agents/skills/web-verify/scripts/cli click --role tab --name "Amend last"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role tab --name "Single commit"`
   Look for: the text shows; the button “Commit selected files” is disabled.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the text is gone.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the text “succeeded” shows.
9. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Commit changes” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A draft of content that changed after the dialog opened is flagged at once, and looking again lets it commit

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the button “Commit” is enabled.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the text “README.md” shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Generate with AI"`
   Look for: the textbox “Message” holds drafted; the text shows; the button “Commit selected files” is disabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Look again"`
   Look for: the text is gone.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the text “succeeded” shows.
5. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Commit changes” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 3. When the file of a later group changes after the groups were drafted, looking again after its refusal flags the remaining groups as stale

Before driving, on the instance (the sample repository and project home are in the instance file):

- put the fake coding tool on the server PATH as `claude` (the disposable server has no coding CLI until then)
- commit everything in the sample repository as “Commit the sample change first”
- write `README.md` in the sample repository
- write `later` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the button “Commit” is enabled.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Use groups"`
   Look for: the textbox “Message for commit 1” holds groups[0]?.message ?? ''.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit groups in order"`
   Look for: the text “Commit 1 · committed” shows; the alert reads /changed since looked/i.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Look again"`
   Look for: the text shows; the button “Commit groups in order” is disabled.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-stale-draft.test.tsx` (Browser Mode integration): a draft the worktree moved past is refused, and after looking again the dialog says it is stale until it is generated again; a draft of content that changed after the dialog opened is flagged at once, and looking again lets it commit; when the file of a later group changes after the groups were drafted, looking again after its refusal flags the remaining groups as stale.
- The tests read back what the server kept through the kit: `server.changes()`, `server.commits()`, `server.text()`.

## Gotchas

- The disposable server has no coding CLI until the fake one is put on its PATH, so Generate with AI is unavailable on a fresh instance.
