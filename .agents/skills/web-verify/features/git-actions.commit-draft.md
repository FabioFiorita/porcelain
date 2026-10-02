---
route: /
selectors:
  - "Commit"
  - "Commit model"
  - "Generate with AI"
  - "Use groups"
  - "Commit selected files"
  - "Message"
  - "succeeded"
tests:
  - apps/web/spec/integration/git-actions-commit-draft.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit-draft

## What it is

Without a coding CLI on the server the commit dialog says no model is available and keeps drafting and groups disabled, and a message typed by hand still commits.

## How a user reaches it

- Commit → Commit model, Generate with AI, Use groups

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Without a coding CLI the commit dialog says drafting is unavailable, and a typed message still commits

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the combobox “Commit model” is disabled; the combobox “Commit model” holds 'No coding CLI available'; the button “Generate with AI” is disabled; the tab “Use groups” is disabled; the button “Commit selected files” is disabled.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Commit written by hand"`
   Look for: the button “Commit selected files” is enabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the text “succeeded” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-commit-draft.test.tsx` (Browser Mode integration): without a coding CLI the commit dialog says drafting is unavailable, and a typed message still commits.
- The tests read back what the server kept through the kit: `server.commitModels()`, `server.commits()`.

## Gotchas

- None known.
