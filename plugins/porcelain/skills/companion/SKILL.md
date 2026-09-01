---
name: companion
description: Use Porcelain's MCP collaboration surfaces for Canvases, review comments, repository profiles, and user-run Actions. Use when the human asks to use Porcelain or repository instructions require Porcelain dogfooding. Do not load for ordinary coding merely because the plugin is installed.
license: MIT
---

# Porcelain companion

Porcelain owns collaboration state around agent-created work; it does not replace the harness's
file, Git, terminal, browser, device, execution, or reasoning tools.

## Choose the owner

- `porcelain_project` resolves the exact Project and Worktree.
- `porcelain_canvas` authors Decision and Review Canvases.
- `porcelain_comment` participates in focused review conversations.
- `porcelain_profile` reads or promotes the human's navigation profile.
- `porcelain_action` defines commands the human may choose to run.

Tool schemas are the authority for current operations and payloads. Target the current checkout by
its absolute `workspace` path; use Project and Worktree ids only after resolving another checkout.

## Collaboration rules

Confirm the intended checkout before writing collaboration state. Read comments when responding to
review feedback and read the profile only when it affects the task. Preserve pins and hidden paths
unless the human asks to change them.

Create one Decision Canvas only for a material unresolved choice. Keep its id and update it as
evidence changes; record a decision after the human chooses. Do not create progress Canvases.

For a coherent completed unit that benefits from explanation, create or update one Review Canvas
with concise Why and How, attention-ordered layers, important files, and observed evidence. Preserve
its id. A dirty Review is live-only; after committing and cleaning the checkout, update the same
Review until Porcelain confirms it is bound to that commit for History.

Changes remains authoritative for diffs, status, staging, reviewed state, and History. Canvas owns
the larger explanation; comments own focused context. A Canvas never substitutes for source
inspection, tests, diffs, or runtime evidence.

Use MCP tools rather than private daemon storage or internal endpoints. Promotion makes selected
Canvas or profile data repository-visible but never stages or commits it. Keep secrets out of
Porcelain collaboration state. Define or edit an Action only when asked; the agent never executes,
approves, or works around its human trust gate.
