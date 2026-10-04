---
screen: /files
selectors:
  - 'Files'
  - 'Select a worktree to continue.'
  - 'files-search'
  - 'Find a file'
  - 'Clear search'
  - 'Reload files'
  - 'Reload file'
  - 'Reloading file…'
  - 'Reloading files…'
  - 'Read only'
  - 'Back to files'
  - 'Read again'
  - 'Reading files…'
  - 'No matching files.'
  - 'This folder is empty.'
  - 'This file is empty.'
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
  - apps/mobile/spec/e2e/files.e2e.ts
  - apps/mobile/spec/e2e/files.tablet.e2e.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/paths
  - GET /api/worktrees/:worktreeId/text
---

# files.files

## What it is

Files browses the selected worktree through the shared client's directory, paths and text reads. Folders load when expanded; Find a file searches relative paths. Opening a file shows its literal, selectable text in a read-only native renderer, with Back to files and Reload file. Binary, unsupported and oversized text get an explanation. An empty file and an empty folder have distinct states. The workspace picker is `projects.workspace-picker`; changing its selection resets file navigation and search.

Presentation follows Porcelain web Files: neutral theme surfaces, bordered search/document toolbars, touch-sized action and file rows, indented folder branches and secondary relative paths in search. The document pairs selectable monospaced code with a muted line-number gutter. Long lines scroll horizontally together with the gutter rather than wrapping or clipping the source. Light and dark use the shared theme tokens.

## How a user reaches it

- phone: the Files tab; iPad: Files in the sidebar
- the deep link `porcelain.dev://files` (the CLI opens it as `/files`)

## Driving it

After explicit clearance for the assigned iPhone, follow the skill's doctor and development-client freshness checks, then start one independent instance with `.agents/skills/mobile-verify/scripts/cli start --device iphone`. Set `files_instance` to its returned ID and pass `--instance "$files_instance"` on every subsequent command. Keep its server, Metro ports and session independent; direct agent-device commands must retain the assigned host and session flags. Do not overwrite the shared device-host configuration. Reuse this instance during active proof and screenshots, and stop only your instance at completion or memory pressure. Open Files before choosing a worktree to check its empty state, then select the sample worktree through `projects.workspace-picker`.

Agent native acceptance is iPhone-only. Tablet implementation and static/test coverage remain in place; the owner performs iPad native validation and screenshots. Agents do not start iPad instances, investigate tablet pairing refusals or run tablet Maestro flows.

```sh
.agents/skills/mobile-verify/scripts/cli open /files --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli snapshot --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli tap --label README.md --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli snapshot --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli screenshot --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli tap --label "Back to files" --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli fill README --id files-search --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli snapshot --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli tap --label "Clear search" --instance "$files_instance"
.agents/skills/mobile-verify/scripts/cli tap --label "Reload files" --instance "$files_instance"
```

Look for: the selected worktree's directory entries; README.md opens as literal code with Read only and both navigation buttons. Back returns to the tree. Search shows matching relative paths and Clear search returns to the tree. Inspect the selected Files tab on the assigned iPhone. The owner separately inspects the iPad detail and sidebar.

For the presentation proof, inspect both light and dark: row touch targets and folder indentation, muted search-path metadata, toolbar borders, read-only badge and aligned code/gutter typography. Add a source line wider than the viewport and check horizontal scrolling reaches its end while retaining literal indentation; the full path remains readable in the document header. Compare fresh screenshots with the revised UI, since the earlier Files screenshots cover the prior presentation only.

The instance's `000-start.txt` evidence names its disposable repository. Add a nested folder with a Unicode text file, an empty file, a file containing NUL bytes and a file exceeding `TEXT_BYTES` from `@porcelain/contracts/shared` there. Reload files, expand the folder using its `Expand <name>` label, open each file, and capture the text and the unreadable explanations. Collapse uses `Collapse <name>`. Confirm that returning from a file preserves expanded folders. Search an absent path to see No matching files.

With the text file open, edit it in the disposable repository, tap Reload file and check the new text. Delete it, reload, and check the server's Path not found error, Read again and Back to files, with no previous text displayed. Restore it and tap Read again. Remove a selected linked worktree and check that its next read fails or the picker marks it unavailable; choose a remaining worktree to recover. Switch environments while a file is open and check that the previous file disappears, then select a worktree in the new environment and browse its own files.

During a reload, loaded code stays visible in the same scroll view while the disabled button says Reloading file…. Loaded directory/search lists also stay visible while Reloading files… is busy. A completed failure hides stale content and offers Read again.

Finish the assigned iPhone drive with `evidence --instance "$files_instance"`, inspect the recorded files, and `stop --instance "$files_instance"`. Report iPhone proof separately from owner-delegated iPad validation.

## What proves it works

The specs below define platform coverage; naming a spec does not mean it has executed. Keep tablet files and static checks, with native tablet execution delegated to the owner.

- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Files directly with the tab selected and its empty state.
- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the Files tab is selected and shows its empty state.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad split keeps Files through a sidebar collapse.
- `apps/mobile/spec/e2e/files.e2e.ts` and `files.tablet.e2e.ts`: nested browsing, empty states, literal Unicode and Markdown characters, binary and oversized text, search, file reload, deletion/recovery, and environment switching. Real server evidence confirms all three reads and no file-edit request; the fixture's source text stays at its externally restored value.
- `packages/client/src/features/files/rules/navigation.spec.ts`: literal paths, case-insensitive matching and preserved errors.
- `packages/client/spec/integration/files.integration.ts`: real paired server reads, unreadable limits, disk reload/deletion/recovery and a linked worktree removed underneath.
- `packages/client/src/features/files/queries/recovery.spec.ts`: typed 409 worktree-change responses refresh inventory, stop for an unavailable selection, refresh the parent directory and paths before a text reread, and allow only one recovery. Other conflicts and cancellation do not start another read.

## Gotchas

- Symlinks, submodules and other non-file entries are visible but cannot be opened as text.
- Failed reloads hide cached text. Read again retries; Back to files remains available.
- Reads use the projects-owned selected connection, including remote credentials, timeout and selection cancellation.
- A worktree_changed read refreshes the selected inventory before one reread; text recovery also refreshes its affected directory and path list. Another failure is shown for an explicit retry, never an automatic loop.
- The tablet layout hides its sidebar in portrait; its `/files` deep link still reaches Files. The owner validates this native behavior and handles tablet pairing prerequisites.
- Android has its own text renderer and still needs a separate native drive. Physical-device local-network permission is covered by the pairing map.
