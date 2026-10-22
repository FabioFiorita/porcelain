---
route: /
selectors:
  - "Review"
  - "Changes"
  - "Toggle Sidebar"
  - "Settings"
  - "Spec files"
  - "Back"
tests:
  - apps/web/spec/e2e/reviews-spec-files.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/changes
---

# reviews.spec-files

When the Spec files setting is on, specs and tests have a separate section in the review sidebar and follow other files in code documents.

## Sub-features

- `reviews.spec-files` — Specification files and supporting context.

## How to get to it (user POV)

- Settings → Reviews & Git → Spec files; review sidebar → Open all specs.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Create untracked `search.ts` and `search.spec.ts` in `REPO` before loading. Keep the initial modified README.md, for three changes.

Open all specs opens a continuous document containing just those files, with individual and bulk reviewed controls. All changes still includes specs. The Settings switch "Spec files" enables this grouping and starts the section and its files collapsed. Off keeps specs in the ordinary file list and its original order. It does not remove them from progress or coverage.

1. With the setting off, open Review → Changes. Expect README.md, search.spec.ts and search.ts in their original order, with no Specs section.
2. Close the phone review sheet with Escape, then Toggle Sidebar → Settings. Switch Spec files on and Back.
3. Open Review and expand Specs · 1 files. Open all specs shows Specs with "1 files", its file diff and reviewed control. Mark it and verify `$C server reviewed-files` contains search.spec.ts only.
4. Open Review again. Specs remains a visible counted section but its contents start collapsed. Expand its summary to see Open all specs and search.spec.ts. Expand the file in its document to read code.
5. Reload: the collapse preference remains. Turn it off through Settings and remove the two setup files when finished.
6. With the review sample (`$C start --review-sample`), open All changes and verify its count remains 55, while Specs is eight files and the walkthrough ends with a "Specs" stop. Marks in Specs do not mark ordinary source files or record any decision.

Automated coverage: `reviews-spec-files.e2e.ts`.

## Gotchas

- The setting persists in this browser; grouping does not remove specs from progress/coverage or mark a decision.
