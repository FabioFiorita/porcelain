# git-actions.stale-draft

## What it is

A drafted message or group whose files no longer match what the dialog looked at is flagged stale and blocks the commit until it is generated again, so a commit never pairs a draft with content it did not describe.

## How a user reaches it

- Group "Git controls" → button "Commit" → button "Generate with AI" (or tab "Use groups") → a file changes on disk → button "Commit selected files" (refused) → button "Look again".
- The stale alert reads "The worktree changed since this draft was proposed. Generate it again before committing."

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start --coding-tool`, then `REPO=<the repository path start printed>`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

Every case drafts with the coding CLI: `start --coding-tool` puts the kit's fake `claude` on the server's PATH, as the tests' `codingTool.install()` does. The fake drafts the message "Explain the change to review in the README" and the groups "Explain the change to review in the README" (README.md), "Add notes for the reviewer" (NOTES.md).

Below, STALE means the alert "The worktree changed since this draft was proposed. Generate it again before committing."

### Case 1: a draft the worktree moved past is refused, and after Look again it stays stale until generated again

No setup on a fresh instance (README.md modified).

1. Open `/` on the instance web URL, click the button named 'Commit', click the button named 'Generate with AI', then wait for the text 'Explain the change to review in the README'
   Look for: textbox "Message" holds "Explain the change to review in the README".
2. On disk, with the dialog open: `printf 'Changed after the draft\n' > "$REPO/README.md"`
3. Click the button named 'Commit selected files', then wait for the button named 'Look again'
   Look for: alert "changed since looked"; button "Look again".
4. Click the button named 'Look again'
   Look for: STALE shows; button "Commit selected files" [disabled].
5. Click the tab named 'Amend last', then click the tab named 'Single commit'
   Look for: the dialog goes to "Amend last commit" (heading, button "Amend last commit", no STALE there) and back to "Commit changes", where STALE still shows and "Commit selected files" is still [disabled].
6. Click the button named 'Generate with AI'
   Look for: STALE is gone; "Commit selected files" enabled.
7. Click the button named 'Commit selected files', then wait for the text 'succeeded'
   Look for: status "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints nothing.
8. Press `Escape`
   Look for: dialog "Commit changes" is gone.

### Case 2: a draft of content that changed after the dialog opened is flagged at once, and Look again lets it commit

Fresh instance. Setup: `printf 'Seen when the dialog opened\n' > "$REPO/README.md"`, then open `/` on the instance web URL and wait for text containing 'Seen when the dialog opened' (the README.md diff).

1. Click the button named 'Commit'
   Look for: dialog "Commit changes" listing "README.md".
2. On disk, with the dialog open: `printf 'Changed before the draft\n' > "$REPO/README.md"`
3. Click the button named 'Generate with AI', then wait for the text 'Explain the change to review in the README'
   Look for: Message holds the drafted text; STALE shows at once; "Commit selected files" [disabled]; button "Look again".
4. Click the button named 'Look again'
   Look for: STALE is gone; "Commit selected files" enabled.
5. Click the button named 'Commit selected files', then wait for the text 'succeeded'
   Look for: status "succeeded". Disk: `cat "$REPO/README.md"` prints `Changed before the draft`; `git -C "$REPO" status --porcelain` prints nothing.
6. Press `Escape`
   Look for: the dialog is gone.

### Case 3: when a later group's file changes after drafting, the refusal and Look again flag the remaining groups stale

Fresh instance. Setup on disk:
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'README.md drafted in groups\n' > "$REPO/README.md"
printf 'NOTES.md drafted in groups\n' > "$REPO/NOTES.md"
```
open `/` on the instance web URL, then wait for the button named 'Mark NOTES.md as reviewed' and wait for the button named 'Mark README.md as reviewed'.

1. Click the button named 'Commit', click the tab named 'Use groups', then wait for the button named 'Commit groups in order'
   Look for: textbox "Message for commit 1" holds "Explain the change to review in the README"; textbox "Message for commit 2" holds "Add notes for the reviewer".
2. On disk: `printf 'Changed after the groups were drafted\n' > "$REPO/NOTES.md"`
3. Click the button named 'Commit groups in order', then wait for the button named 'Look again'
   Look for: paragraph "Commit 1 · committed"; alert "changed since looked". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints `?? NOTES.md`.
4. Click the button named 'Look again'
   Look for: STALE shows; button "Commit groups in order" [disabled].

## What proves it works

- STALE blocks the commit until "Generate with AI" runs again, the refused commit leaves history untouched, and the final commits land on disk as listed. Browser network evidence shows `POST /api/worktrees/<worktreeId>/git/commit-draft` and `POST /api/worktrees/<worktreeId>/git/actions`.
- `apps/web/spec/integration/git-actions-stale-draft.test.tsx`: case 1 checks the refusal, STALE and the disabled commit across Amend last / Single commit, then a clean commit of the drafted subject; case 2 checks STALE right after the draft, its removal by Look again, the committed README text and no changes left; case 3 checks "Commit 1 · committed", the refusal, then STALE with "Commit groups in order" disabled.

## Gotchas

- The fake coding CLI exists only with `start --coding-tool`; an instance started without it cannot draft.
- The disk writes in the middle of a case must happen while the dialog is open: the dialog freezes the files and fingerprints it saw on opening, and staleness compares the draft against that look.
- In groups mode there are both a tab "Single commit" and a button "Single commit" (clears the groups); distinguish the tab from the button.
- Each case commits; run each case on a fresh instance (`$C stop`, `$C start --coding-tool`).
