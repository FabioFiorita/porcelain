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

`$C start --coding-tool`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

`start --coding-tool` puts the kit's fake `claude` on the server's PATH, as the tests' `codingTool.install()` does; without it "Commit model" reads "No coding CLI available" and every step below is disabled. The fake drafts fixed answers: the message "Explain the change to review in the README" (paths README.md), and the groups "Explain the change to review in the README" (README.md) then "Add notes for the reviewer" (NOTES.md). It serves only the models sonnet and haiku.

### Case 1: the chosen model drafts the message and the drafted commit becomes the newest

1. Navigate to `/` on the card’s web URL (full page load), then click button named `Commit`
   Look for: dialog "Commit changes" with tabs "Single commit" [selected], "Amend last", "Use groups"; "Files (1 of 1)" with README.md; button "Generate with AI" and combobox "Commit model" (a shadcn Select; opening it lists "Sonnet" and "Haiku" under "claude").
2. Click combobox named `Commit model`, then option named `Haiku`, then click button named `Generate with AI`
   Look for: the combobox displays "Haiku"; textbox "Message" holds "Explain the change to review in the README" (the submit button reads "Generating…" meanwhile).
3. Click button named `Commit selected files`, then wait for text 'succeeded' to be visible
   Look for: a status reads "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`.
4. Press `Escape`
   Look for: dialog "Commit changes" is gone.

### Case 2: Use groups drafts one commit per group, and committing lands them in order

Setup on disk (fresh instance), then wait for the UI:
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'README.md drafted in groups\n' > "$REPO/README.md"
printf 'NOTES.md drafted in groups\n' > "$REPO/NOTES.md"
```
Then Wait for button named `Mark NOTES.md as reviewed` to be visible and wait for button named `Mark README.md as reviewed` to be visible.

1. Click button named `Commit`
   Look for: dialog "Commit changes" listing "NOTES.md" and "README.md".
2. Click tab named `Use groups`, then wait for button named `Commit groups in order` to be visible
   Look for: status "Proposing commits…" then region "Commit 1" with textbox "Message for commit 1" holding "Explain the change to review in the README" and combobox "Commit for README.md" on option "Commit 1", and region "Commit 2" with textbox "Message for commit 2" holding "Add notes for the reviewer" and combobox "Commit for NOTES.md" on "Commit 2"; buttons "Add group", "Single commit" and "Commit groups in order".
3. Click button named `Commit groups in order`, then wait for text 'Commit 2 · committed' to be visible
   Look for: paragraphs "Commit 1 · committed" and "Commit 2 · committed".
   Disk: `git -C "$REPO" log -2 --format=%s` prints `Add notes for the reviewer` then `Explain the change to review in the README`.
4. Press `Escape`
   Look for: the dialog is gone.

### Case 3: a commit the worktree moved past since the draft is refused, and a new draft must cover every selected file

Setup on disk (fresh instance):
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'Changed before the draft\n' > "$REPO/README.md"
```
Then Wait for button named `Mark README.md as reviewed` to be visible.

1. Click button named `Commit`, click button named `Generate with AI`, then wait for text 'Explain the change to review in the README' to be visible
   Look for: textbox "Message" holds "Explain the change to review in the README".
2. On disk, with the dialog open:
   `printf 'Changed after the draft\n' > "$REPO/README.md"; printf 'Written after the draft\n' > "$REPO/LATER.md"`
3. Click button named `Commit selected files`, then wait for button named `Look again` to be visible
   Look for: alert "changed since looked"; button "Look again". Disk: `git -C "$REPO" status --porcelain` prints ` M README.md` and `?? LATER.md`; newest commit still "Commit the sample change first".
4. Click button named `Look again`
   Look for: "Files (2 of 2)" with "LATER.md changed" and "README.md modified".
5. Click button named `Generate with AI`, then wait for text '/did not cover/' to be visible
   Look for: alert "The generated groups did not cover the selected files. Generate again or write the message manually.", beside the stale alert "The worktree changed since this draft was proposed. Generate it again before committing." (the message still holds the first draft).
6. Click button named `Edit`, then click checkbox named `LATER.md`
   Look for: checkbox "LATER.md" unchecked and its row reading "LATER.md Excluded"; "Files (1 of 2)".
7. Click button named `Generate with AI`
   Look for: both alerts are gone; Message holds "Explain the change to review in the README".
8. Click button named `Commit selected files`, then wait for text 'succeeded' to be visible
   Look for: status "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints only `?? LATER.md`.

## What proves it works

- The drafted subjects land on disk in order (`git log`), the refusal leaves the commit history untouched, and the uncovered draft is refused with the server's message. Inspect HTTP requests and responses shows `POST /api/worktrees/<worktreeId>/git/commit-draft` (200 for drafts, 422 for the uncovered draft in case 3 step 5) and `POST /api/worktrees/<worktreeId>/git/actions`.
- `apps/web/spec/integration/git-actions-draft-commit.test.tsx`: case 1 selects "Haiku", drafts and commits the drafted subject; case 2 checks each group's message and the two subjects in reverse order on the server; case 3 checks the refusal, LATER.md after Look again, the "did not cover" text, waits for the final commit's "succeeded" status, and checks that only LATER.md stays changed.

## Gotchas

- The fake coding CLI exists only with `start --coding-tool`; an instance started without it cannot draft.
- "Commit model" uses shadcn Select: click its combobox, then the option by its label. Provider labels organize the popup, and the trigger displays the chosen model. Both fixture models draft the same text.
- Case 2 needs both README.md and NOTES.md changed: the fake always proposes a NOTES.md group, and the server refuses groups that name a file outside the selection.
- Wait for the watcher (wait until the "Mark … as reviewed" buttons show) before opening the dialog: the dialog freezes the files it saw on opening.
- While a draft runs, the submit button is named `Generating…`; wait for the Message value before clicking "Commit selected files".
- Each case commits; run each on a fresh instance (`$C stop`, `$C start --coding-tool`; pair your browser using the card’s pairing-link command) or rebuild its setup by hand.
