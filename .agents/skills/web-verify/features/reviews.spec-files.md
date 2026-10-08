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

## What it is

When the Spec files setting is on, specs and tests have a separate section in the review sidebar and follow other files in code documents. Open all specs opens a continuous document containing just those files, with individual and bulk reviewed controls. All changes still includes specs. The Settings switch "Spec files" enables this grouping and starts the section and its files collapsed. Off keeps specs in the ordinary file list and its original order. It does not remove them from progress or coverage.

## Driving it

`$C start`; pair your browser. Add untracked search.ts and search.spec.ts in the disposable repository.

1. With the setting off, open Review → Changes. Expect README.md, search.spec.ts and search.ts in their original order, with no Specs section.
2. Close the phone review sheet with Escape, then Toggle Sidebar → Settings. Switch Spec files on and Back.
3. Open Review and expand Specs · 1 files. Open all specs shows Specs with "1 files", its file diff and reviewed control. Mark it and verify `$C server reviewed-files` contains search.spec.ts only.
4. Open Review again. Specs remains a visible counted section but its contents start collapsed. Expand its summary to see Open all specs and search.spec.ts. Expand the file in its document to read code.
5. Reload: the collapse preference remains. Turn it off through Settings and remove the two setup files when finished.
6. With the large architecture fixture, open All changes and verify its count remains 55, while Specs is eight files. Marks in Specs do not mark ordinary source files or architectural walkthroughs.

## What proves it works

The named phone-width E2E spec checks the setting, manual expansion and persisted marks restricted to the Specs document. reviews-all-changes.test.tsx verifies bulk marks cover every changed file in the large fixture.

## Gotchas

The setting is browser-local and persists. Specs classification uses the existing spec-paths rule. Separate presentation reduces reading effort; counts still include these files.
