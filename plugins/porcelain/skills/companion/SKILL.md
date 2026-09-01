---
name: companion
description: Use Porcelain's MCP collaboration surfaces for Canvases, review comments, repository profiles, and user-run Actions. Use when the human asks to use Porcelain or repository instructions require Porcelain dogfooding. Do not load for ordinary coding merely because the plugin is installed.
license: MIT
---

# Porcelain companion

Porcelain helps a human understand and review agent-created work. It does not replace the agent's
native file, Git, terminal, browser, device, or reasoning capabilities. Use Porcelain only for the
collaboration state it owns.

## Choose the domain tool

- `porcelain_project` discovers Projects and Worktrees when the current checkout is not the target.
- `porcelain_canvas` authors a Decision or Review Canvas.
- `porcelain_comment` reads and participates in focused review conversations.
- `porcelain_profile` reads or promotes the human's manual file-navigation profile.
- `porcelain_action` defines a command the human may choose to run.

Use the tool schema as the authority for current operations and payloads. Most calls target the
current checkout with its absolute path as `workspace`; use Project and Worktree ids only when
addressing another checkout.

## Working flow

1. Resolve the intended checkout. Never let a remote Environment or neighboring Worktree become an
   implicit target.
2. Read open comments when the task is responding to review feedback. Read the profile only when it
   affects the requested work, and preserve its pins and hides unless the human explicitly asks
   about them.
3. Create one Decision Canvas only for a material unresolved choice that benefits from a shared
   comparison. Keep its id, update the same Canvas as evidence changes, and record a decision only
   after the human chooses. Do not create progress Canvases for routine implementation.
4. Perform the actual work with the harness's native tools. A Canvas explains the work; it is not a
   substitute for source inspection, tests, diffs, or runtime evidence.
5. Reply to relevant comments with concrete findings. Resolve, reopen, edit, or delete product state
   only when the human requests that change or the current task clearly authorizes it.
6. When a coherent completed unit benefits from a shared review story, create or update one Review
   Canvas with concise Why and How, attention-ordered layers, important files, and evidence actually
   observed. Preserve its id. A dirty Review is live-only; after committing and cleaning the
   checkout, update that same Review until Porcelain confirms it is bound to the commit for History.
7. Define or edit an Action only when asked. The agent never runs, approves, or works around the
   trust gate for an Action; the human reads the command and chooses whether to run it.

## Boundaries

- Changes remains authoritative for diffs, status, staging, reviewed state, and History. Canvas owns
  the larger Why and How; comments own focused context.
- Use MCP tools rather than reading private daemon storage, editing `.porcelain` by hand, or calling
  internal HTTP endpoints.
- Promotion makes selected Canvas or profile data repository-visible but never stages or commits it.
- Keep secrets and credentials out of Canvases, comments, profiles, and Actions.
- Ordinary repository work follows the repository's own instructions and authorization boundaries.
