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
  - "Try again"
tests:
  - apps/web/spec/integration/git-actions-draft-commit.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
  - POST /api/worktrees/:worktreeId/git/commit-draft
---

# git-actions.draft-commit

With a coding CLI on the server, the Commit dialog drafts the message (Generate with AI) or a sequence of commits (Use groups) with the chosen model and commits what was drafted; the server refuses a commit the worktree moved past since the draft, and refuses a draft that leaves a selected file out.

## How to get to it (user POV)

- Group "Git controls" → button "Commit" → dialog "Commit changes" → select "Commit model" (options grouped by provider; with the fake `claude`: "Sonnet", "Haiku") → button "Generate with AI" → button "Commit selected files".
- Same dialog → tab "Use groups" → button "Generate with AI" → button "Commit groups in order".
- An empty or whitespace-only Message disables Commit with a visible reason. The keyboard submit never generates a message. Generate with AI discloses the chosen model and coding CLI, fills the editable field, and leaves committing to a separate click.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `--coding-tool`.

### Setup

`start --coding-tool` puts the kit's fake `claude` on the server's PATH, without it "Commit model" reads "No coding CLI available" and every step below is disabled. The fake drafts fixed answers: the message "Explain the change to review in the README" (paths README.md), and the groups "Explain the change to review in the README" (README.md) then "Add notes for the reviewer" (NOTES.md). It serves only the models sonnet and haiku.

### Case 1: the chosen model drafts the message and the drafted commit becomes the newest

1. Navigate to `/`, then click button `Commit`
   Expect: dialog "Commit changes" with tabs "Single commit" [selected], "Amend last", "Use groups"; "Files (1 of 1)" with README.md; button "Generate with AI" and combobox "Commit model" (a shadcn Select; opening it lists "Sonnet" and "Haiku" under "claude").
2. Click combobox named `Commit model`, then option named `Haiku`, then click button `Generate with AI`
   Expect: the combobox displays "Haiku"; textbox "Message" holds "Explain the change to review in the README" (the submit button reads "Generating…" meanwhile).
3. Review and optionally edit Message. The current HEAD is unchanged until clicking Commit. Click button `Commit selected files`, then wait for 'succeeded'
   Expect: a status reads "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`.
4. Press `Escape`
   Expect: dialog "Commit changes" is gone.

### Case 2: Use groups drafts one commit per group, and committing lands them in order

Setup on disk (fresh instance), then wait for the UI:
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'README.md drafted in groups\n' > "$REPO/README.md"
printf 'NOTES.md drafted in groups\n' > "$REPO/NOTES.md"
```
Then Wait for button named `Mark NOTES.md as reviewed` and wait for button named `Mark README.md as reviewed`.

1. Click button `Commit`
   Expect: dialog "Commit changes" listing "NOTES.md" and "README.md".
2. Click tab `Use groups`, then click button `Generate with AI` and wait for button `Commit groups in order`
   Expect: status "Proposing commits…" then region "Commit 1" with textbox "Message for commit 1" holding "Explain the change to review in the README" and combobox "Commit for README.md" on option "Commit 1", and region "Commit 2" with textbox "Message for commit 2" holding "Add notes for the reviewer" and combobox "Commit for NOTES.md" on "Commit 2"; buttons "Add group", "Single commit" and "Commit groups in order".
3. Click button `Commit groups in order`, then wait for 'Commit 2 · committed'
   Expect: paragraphs "Commit 1 · committed" and "Commit 2 · committed".
   Disk: `git -C "$REPO" log -2 --format=%s` prints `Add notes for the reviewer` then `Explain the change to review in the README`.
4. Press `Escape`
   Expect: the dialog is gone.

### Case 3: a commit the worktree moved past since the draft is refused, and a new draft must cover every selected file

Setup on disk (fresh instance):
```sh
git -C "$REPO" add --all && git -C "$REPO" -c user.name='Porcelain Verification' -c user.email=verify@example.invalid commit -m "Commit the sample change first"
printf 'Changed before the draft\n' > "$REPO/README.md"
```
Then Wait for button named `Mark README.md as reviewed`.

1. Click button `Commit`, click button `Generate with AI`, then wait for 'Explain the change to review in the README'
   Expect: textbox "Message" holds "Explain the change to review in the README".
2. On disk, with the dialog open:
   `printf 'Changed after the draft\n' > "$REPO/README.md"; printf 'Written after the draft\n' > "$REPO/LATER.md"`
3. Click button `Commit selected files`, then wait for button `Look again`
   Expect: alert "changed since looked"; button "Look again". Disk: `git -C "$REPO" status --porcelain` prints ` M README.md` and `?? LATER.md`; newest commit still "Commit the sample change first".
4. Click button `Look again`
   Expect: "Files (2 of 2)" with "LATER.md changed" and "README.md modified".
5. Click button `Generate with AI`, then wait for '/did not cover/'
   Expect: alert "The generated groups did not cover the selected files. Generate again or write the message manually.", with a Try again button, beside the stale alert "The worktree changed since this draft was proposed. Generate it again before committing." (the message still holds the first draft).
6. Click button `Edit`, then click checkbox named `LATER.md`
   Expect: checkbox "LATER.md" unchecked and its row reading "LATER.md Excluded"; "Files (1 of 2)".
7. Click button `Try again`
   Expect: both alerts are gone; Message holds "Explain the change to review in the README".
8. Click button `Commit selected files`, then wait for 'succeeded'
   Expect: status "succeeded". Disk: `git -C "$REPO" log -1 --format=%s` prints `Explain the change to review in the README`; `git -C "$REPO" status --porcelain` prints only `?? LATER.md`.

### Observable proof

Read drafted commit order from Git; refused/uncovered drafts leave history unchanged. Draft POST answers 200 or 422 for uncovered files.

Automated coverage: `git-actions-draft-commit.test.tsx`.

## Gotchas

- If the coding CLI offers models without an automatic default, "Choose a model to generate a message" keeps Generate disabled until a model is selected. Model loading or a failed catalogue read still allows a typed manual commit.
- Requires --coding-tool. Commit model is a combobox with labelled options/provider groups; both fixture models draft the same text.
- Case 2 needs README and NOTES changed because the fixture proposes NOTES. Wait for watcher updates before opening: the dialog captures that file set.
- Generating… must finish and Message fill before submit. Each case commits; use fresh setup for each.
