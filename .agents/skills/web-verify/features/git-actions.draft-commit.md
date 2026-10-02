---
route: /
selectors:
  - "Commit"
  - "Commit changes"
  - "Commit model"
  - "Generate with AI"
  - "Message"
  - "Commit selected files"
  - "succeeded"
  - "Use groups"
  - "Proposing commits"
  - "Message for commit"
  - "Commit groups in order"
  - " · committed"
  - "Look again"
  - "Edit"
  - "Excluded"
tests:
  - apps/web/spec/integration/git-actions-draft-commit.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
  - POST /api/worktrees/:worktreeId/git/commit-draft
---

# git-actions.draft-commit

## What it is

With a coding CLI on the server, the Commit dialog drafts the message (Generate with AI) or a sequence of commits (Use groups) with the chosen model and commits what was drafted; the server refuses a commit the worktree moved past since the draft, and refuses a draft that leaves a selected file out.

## How a user reaches it

- Group "Git controls" → button "Commit" → dialog "Commit changes" → select "Commit model" (options grouped by provider; with the fake `claude`: "Sonnet", "Haiku") → button "Generate with AI" → button "Commit selected files".
- Same dialog → tab "Use groups" (drafts at once) → button "Commit groups in order".
- Leaving textbox "Message" empty and clicking "Commit selected files" also drafts the message first, then commits.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.

### Setup

Blocked: the CLI's default instance has no coding CLI (sandbox PATH holds only `git`), so "Commit model" reads "No coding CLI available" and every step below is disabled. CLI gap: `cli start --coding-tool` (or `cli coding-tool install` on a live instance), which must do what the kit's `installCodingTool()` does: symlink the server's bundled fake (`coding-tool/claude.mjs`) as `claude` into the sandbox bin folder. After installing mid-instance, run `$C open /` so the web refetches `GET /api/git/commit-models`.

The fake drafts fixed answers: the message "Explain the change to review in the README" (paths README.md), and the groups "Explain the change to review in the README" (README.md) then "Add notes for the reviewer" (NOTES.md). It serves only the models sonnet and haiku.

### Case 1: the chosen model drafts the message and the drafted commit becomes the newest

1. `$C open /`, then `$C click --role button --name "Commit"`
   Look for: dialog "Commit changes"; combobox "Commit model" enabled and showing "Sonnet" (the default when nothing was chosen before).
2. `$C click --role button --name "Generate with AI"`
   Look for: textbox "Message" holds "Explain the change to review in the README" (the submit button reads "Generating…" meanwhile).
3. `$C click --role button --name "Commit selected files"`
   Look for: a status reads "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`.
4. `$C press Escape`
   Look for: dialog "Commit changes" is gone.

### Case 2: Use groups drafts one commit per group, and committing lands them in order

Setup on disk (fresh instance), then wait for the UI:
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'README.md drafted in groups\n' > "$REPO/README.md"
printf 'NOTES.md drafted in groups\n' > "$REPO/NOTES.md"
```
`$C snapshot` until buttons "Mark README.md as reviewed" and "Mark NOTES.md as reviewed" both show.

1. `$C click --role button --name "Commit"`
   Look for: dialog "Commit changes" listing "NOTES.md" and "README.md".
2. `$C click --role tab --name "Use groups"`
   Look for: status "Proposing commits…" then regions "Commit 1" and "Commit 2"; textbox "Message for commit 1" holds "Explain the change to review in the README"; textbox "Message for commit 2" holds "Add notes for the reviewer"; button "Commit groups in order".
3. `$C click --role button --name "Commit groups in order"`
   Look for: texts "Commit 1 · committed" and "Commit 2 · committed".
   Disk: `git -C "$REPO" log -2 --format=%s` prints `Add notes for the reviewer` then `Explain the change to review in the README`.
4. `$C press Escape`
   Look for: the dialog is gone.

### Case 3: a commit the worktree moved past since the draft is refused, and a new draft must cover every selected file

Setup on disk (fresh instance):
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'Changed before the draft\n' > "$REPO/README.md"
```
`$C snapshot` until button "Mark README.md as reviewed" shows.

1. `$C click --role button --name "Commit"`, then `$C click --role button --name "Generate with AI"`
   Look for: textbox "Message" holds "Explain the change to review in the README".
2. On disk, with the dialog open:
   `printf 'Changed after the draft\n' > "$REPO/README.md"; printf 'Written after the draft\n' > "$REPO/LATER.md"`
3. `$C click --role button --name "Commit selected files"`
   Look for: alert "changed since looked"; button "Look again". Disk: `git -C "$REPO" status --porcelain` prints ` M README.md` and `?? LATER.md`; newest commit still "Commit the sample change first".
4. `$C click --role button --name "Look again"`
   Look for: text "LATER.md" in the dialog's Files list "(2 of 2)".
5. `$C click --role button --name "Generate with AI"`
   Look for: alert "The generated groups did not cover the selected files. Generate again or write the message manually."
6. `$C click --role button --name "Edit"`, then `$C click --role checkbox --name "LATER.md"`
   Look for: the LATER.md row reads "Excluded"; Files list "(1 of 2)".
7. `$C click --role button --name "Generate with AI"`
   Look for: the "did not cover" alert is gone; Message holds the drafted text again.
8. `$C click --role button --name "Commit selected files"`
   Look for: status "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints only `?? LATER.md`.

## What proves it works

- The drafted subjects land on disk in order (`git log`), the refusal leaves the commit history untouched, and the uncovered draft is refused with the server's message. `$C network` shows `POST /api/worktrees/<worktreeId>/git/commit-draft` (200 for drafts, 422 for the uncovered draft in case 3 step 5) and `POST /api/worktrees/<worktreeId>/git/actions`.
- `apps/web/spec/integration/git-actions-draft-commit.test.tsx`: case 1 selects "Haiku", drafts and commits the drafted subject; case 2 checks each group's message and the two subjects in reverse order on the server; case 3 checks the refusal, LATER.md after Look again, the "did not cover" text, and that only LATER.md stays changed after the final commit.

## Gotchas

- Unreachable through the CLI: needs the fake coding CLI on the server's PATH; the command needed is `cli start --coding-tool` (or `cli coding-tool install`).
- Choosing a model: the CLI has no command to pick an option of a native select, so the test's "Haiku" step cannot be driven; the default "Sonnet" drafts the same text. CLI gap: `cli select --role combobox --name "Commit model" "Haiku"`.
- Case 2 needs both README.md and NOTES.md changed: the fake always proposes a NOTES.md group, and the server refuses groups that name a file outside the selection.
- Wait for the watcher (snapshot until the "Mark … as reviewed" buttons show) before opening the dialog: the dialog freezes the files it saw on opening.
- While a draft runs, the submit button is named "Generating…"; wait for the Message value before clicking "Commit selected files".
- Each case commits; run each on a fresh instance (`$C stop`, `$C start`) or rebuild its setup by hand.
