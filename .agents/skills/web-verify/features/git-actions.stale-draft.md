---
route: /
selectors:
  - "Commit"
  - "Commit changes"
  - "Generate with AI"
  - "Message"
  - "Commit selected files"
  - "Look again"
  - "Amend last"
  - "Amend last commit"
  - "Single commit"
  - "succeeded"
  - "The worktree changed since this draft was proposed"
  - "Use groups"
  - "Message for commit"
  - "Commit groups in order"
  - " · committed"
tests:
  - apps/web/spec/integration/git-actions-stale-draft.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
  - POST /api/worktrees/:worktreeId/git/commit-draft
---

# git-actions.stale-draft

A drafted message or group whose files no longer match what the dialog looked at is flagged stale and blocks the commit until it is generated again, so a commit never pairs a draft with content it did not describe.

## How to get to it (user POV)

- Group "Git controls" → button "Commit" → button "Generate with AI" (or tab "Use groups") → a file changes on disk → button "Commit selected files" (refused) → button "Look again".
- The stale alert reads "The worktree changed since this draft was proposed. Generate it again before committing."

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `--coding-tool`.

### Setup

Every case drafts with the coding CLI: `start --coding-tool` puts the kit's fake `claude` on the server's PATH. The fake drafts the message "Explain the change to review in the README" and the groups "Explain the change to review in the README" (README.md), "Add notes for the reviewer" (NOTES.md).

Below, STALE means the alert "The worktree changed since this draft was proposed. Generate it again before committing."

### Case 1: a draft the worktree moved past is refused, and after Look again it stays stale until generated again

No setup on a fresh instance (README.md modified).

1. Navigate to `/`, click button `Commit`, click button `Generate with AI`, then wait for 'Explain the change to review in the README'
   Expect: textbox "Message" holds "Explain the change to review in the README".
2. On disk, with the dialog open: `printf 'Changed after the draft\n' > "$REPO/README.md"`
3. Click button `Commit selected files`, then wait for button `Look again`
   Expect: alert "changed since looked"; button "Look again".
4. Click button `Look again`
   Expect: STALE shows; button "Commit selected files" [disabled].
5. Click tab `Amend last`, then click tab `Single commit`
   Expect: the dialog goes to "Amend last commit" (heading, button "Amend last commit", no STALE there) and back to "Commit changes", where STALE still shows and "Commit selected files" is still [disabled].
6. Click button `Generate with AI`
   Expect: STALE is gone; "Commit selected files" enabled.
7. Click button `Commit selected files`, then wait for 'succeeded'
   Expect: status "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints nothing.
8. Press `Escape`
   Expect: dialog "Commit changes" is gone.

### Case 2: a draft of content that changed after the dialog opened is flagged at once, and Look again lets it commit

Fresh instance. Setup: `printf 'Seen when the dialog opened\n' > "$REPO/README.md"`, then navigate to `/` and wait for text '/Seen when the dialog opened/' (the README.md diff).

1. Click button `Commit`
   Expect: dialog "Commit changes" listing "README.md".
2. On disk, with the dialog open: `printf 'Changed before the draft\n' > "$REPO/README.md"`
3. Click button `Generate with AI`, then wait for 'Explain the change to review in the README'
   Expect: Message holds the drafted text; STALE shows at once; "Commit selected files" [disabled]; button "Look again".
4. Click button `Look again`
   Expect: STALE is gone; "Commit selected files" enabled.
5. Click button `Commit selected files`, then wait for 'succeeded'
   Expect: status "succeeded". Disk: `cat "$REPO/README.md"` prints `Changed before the draft`; `git -C "$REPO" status --porcelain` prints nothing.
6. Press `Escape`
   Expect: the dialog is gone.

### Case 3: when a later group's file changes after drafting, the refusal and Look again flag the remaining groups stale

Fresh instance. Setup on disk:
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'README.md drafted in groups\n' > "$REPO/README.md"
printf 'NOTES.md drafted in groups\n' > "$REPO/NOTES.md"
```
Navigate to `/`, then wait for button `Mark NOTES.md as reviewed` and wait for button named `Mark README.md as reviewed`.

1. Click button `Commit`, click tab `Use groups`, then wait for button `Commit groups in order`
   Expect: textbox "Message for commit 1" holds "Explain the change to review in the README"; textbox "Message for commit 2" holds "Add notes for the reviewer".
2. On disk: `printf 'Changed after the groups were drafted\n' > "$REPO/NOTES.md"`
3. Click button `Commit groups in order`, then wait for button `Look again`
   Expect: paragraph "Commit 1 · committed"; alert "changed since looked". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints `?? NOTES.md`.
4. Click button `Look again`
   Expect: STALE shows; button "Commit groups in order" [disabled].

### Observable proof

STALE blocks commit until regeneration. Read unchanged Git after refusal and final ordered subjects after success; record draft/action POSTs.

Automated coverage: `git-actions-stale-draft.test.tsx`.

## Gotchas

- Requires --coding-tool. Make staleness writes while the dialog is open, after its initial file/fingerprint read.
- Groups mode has both tab and button Single commit; distinguish roles. Each case commits and needs fresh setup.
