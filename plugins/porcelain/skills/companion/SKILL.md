---
name: companion
description: Use Porcelain's MCP collaboration surfaces for Canvases, review comments and marks, repository profiles, and user-run Actions. Use when the human asks to use Porcelain or repository instructions require Porcelain dogfooding. Do not load for ordinary coding merely because the plugin is installed.
license: MIT
---

# Porcelain companion

Porcelain owns collaboration state around agent-created work; it does not replace the harness's
file, Git, terminal, browser, device, execution, or reasoning tools.

## Choose the owner

- `porcelain_project` resolves the exact Project and Worktree.
- `porcelain_canvas` authors Decision and Review Canvases.
- `porcelain_comment` participates in focused review conversations.
- `porcelain_review` reads or updates content-bound reviewed marks in Changes.
- `porcelain_profile` reads or explicitly edits the human's navigation profile.
- `porcelain_action` defines commands the human may choose to run.

Tool schemas are the authority for current operations and payloads. Target the current checkout by
its absolute `workspace` path; use Project and Worktree ids only after resolving another checkout.

## Collaboration rules

Confirm the intended checkout before writing collaboration state. Read comments when responding to
review feedback and read the profile only when it affects the task. Preserve pins and hidden paths
unless the human asks to change them.

Create one Decision Canvas only for a material unresolved choice. Keep its id, update it as evidence
changes, and record the human's decision. When a plan or system walkthrough would materially reduce
ambiguity, create one generic Markdown or HTML Canvas and keep updating that same Canvas; use rich
HTML or SVG when a diagram, comparison, or state flow communicates better than prose. Do not create
a status diary or a new Canvas for every phase.

## Companion flow

Before coding:

1. Resolve the exact checkout and read open comments. Read the profile only when navigation choices
   affect the task; never reinterpret pins or hides as agent-owned configuration.
2. For substantial work, explain the intended shape in the existing plan/walkthrough Canvas, or
   create one when a visual explanation is useful. Use a Decision Canvas only when a real choice is
   unresolved.

During work:

1. Keep the walkthrough current when the implementation meaningfully changes.
2. Reply to human comments in their threads. Add concise agent comments to an important whole file
   or line range when the reviewer needs a local invariant, risk, or reason that does not belong in
   the larger Canvas. Do not narrate obvious code.
3. Use the harness's native tools for implementation and proof. Porcelain records collaboration;
   it does not prove behavior by itself.

After implementation:

1. Run the smallest relevant proof and inspect the complete diff.
2. Create or update one Review Canvas for the coherent unit. Write an attention-first walkthrough:
   summary and ordered sections, sandboxed HTML/SVG where it clarifies the design, code references,
   observed checks, and useful screenshot/video/document evidence. Record failures and skipped proof
   honestly. Put local evidence assets in one source directory and pass it with the Canvas write so
   the bundle remains self-contained.
3. Define layers by review meaning and risk rather than generic file type. Put the highest-risk
   behavior and contracts first, integration next, and mechanical exports or low-risk support last.
   List files in the exact order a human should inspect them inside those layers. Changes includes
   any unlisted changed file safely at the end of its layer.
4. Add focused comments on important files when the diff alone does not carry enough context.
5. Read reviewed state as needed. Mark or unmark files only when the human asks or explicitly
   delegates review completion; never claim the human reviewed a file merely because the agent did.
6. Preserve the Review Canvas id. A dirty Review is live-only. After committing and cleaning the
   checkout, update that same Review until Porcelain confirms it is bound to the exact commit for
   History.

Changes remains authoritative for diffs, status, staging, reviewed state, and History. Canvas owns
the larger explanation; comments own focused context. A Canvas never substitutes for source
inspection, tests, diffs, or runtime evidence.

Use MCP tools rather than private daemon storage or internal endpoints. Promotion makes selected
Canvas or profile data repository-visible but never stages or commits it. Keep secrets out of
Porcelain collaboration state. Define or edit an Action only when asked; the agent never executes,
approves, or works around its human trust gate.
