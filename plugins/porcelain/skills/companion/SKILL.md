---
name: companion
description: Use Porcelain's MCP collaboration surfaces for Canvases, review comments and marks, repository profiles, and user-run Actions. Use when the human asks to use Porcelain or repository instructions require Porcelain dogfooding. Do not load for ordinary coding merely because the plugin is installed.
license: MIT
---

# Porcelain companion

Porcelain records collaboration around agent work. Use the harness's native tools for files,
Git, terminals, browsers, devices, execution, and proof. Tool schemas own current operations and
payloads; use MCP rather than private daemon storage or internal endpoints.

## Target and ownership

Resolve the intended checkout with `porcelain_project` before writing collaboration state. Use its
absolute `workspace` path; resolve Project and Worktree ids when targeting another checkout. This
is a tool lookup, not a request for human confirmation when the task already identifies the checkout.

- `porcelain_canvas` owns generic HTML/Markdown Canvases and structured Decision/Review Canvases.
- `porcelain_comment` owns focused review conversations. Read relevant threads before responding.
- `porcelain_review` owns content-bound reviewed marks. Change them only when the human asks or
  delegates review completion; agent inspection does not mean the human reviewed a file.
- `porcelain_profile` owns navigation choices. Read it when relevant; preserve pins and hidden paths
  unless the human asks to change them.
- `porcelain_action` defines commands for the human to run. Define or edit one when asked; never
  execute, approve, or bypass its human trust gate.

Changes remains authoritative for diffs, status, staging, reviewed state, and History. Promotion
makes selected Canvas or profile data repository-visible; it does not stage or commit it. Keep
secrets out of collaboration state.

## Choose useful context

Create a Decision Canvas for a material unresolved choice and record the human's decision. Use a
plan or walkthrough Canvas when it helps explain the work, and a Review Canvas when a completed
unit benefits from a shared explanation. Update the same Canvas as the work changes. Small fixes
do not require a Canvas or a before/during/after ceremony unless the human requests one.

Put focused invariants, reasons, or risks in comments anchored to the relevant file, line range,
Canvas section, or changeset. Avoid status diaries and comments that repeat obvious code.

For HTML/SVG Canvases, include self-contained styling and responsive geometry with legible labels
and contrast. Inspect the rendered result in Porcelain for clipping, overlap, and unintended
scrolling before reporting it complete. Bundle local evidence assets from one source directory.

## Reveal: explain completed work

Use Reveal when the human chooses it for a task or as their preferred handoff. It combines
Porcelain's surfaces; it is not a Canvas format or a required before/during/after ceremony.

Explain the task and resulting behavior in a Review Canvas. Organize Changes into meaningful
layers and order files by the attention their actual changes need. Add focused comments where
local context helps, and answer the human's existing questions. Include evidence, risks, and
unverified behavior in the Canvas, with references into the relevant files and changes. Keep these
surfaces connected so the human can move from the explanation to the diff and its discussion.

Canvas remains a playground outside this flow: use HTML or Markdown for whatever the human needs
to understand, at the time they find useful. Decision and Review are available structures, not
the limits of Canvas.

## Review contract

Explain the change in the order a reviewer needs: consequential behavior and contracts first,
integration next, mechanical support last. Include observed checks, failures, and unverified paths.
A Canvas supplements the diff and runtime evidence; it does not replace them.

When using the full `document` MCP shape for a Review, include its sibling `reviewMetadata` with
complete `layers` and `files` arrays; incomplete metadata is rejected. Layers
represent review meaning and risk, with files ordered for inspection. A layer `pattern` is JavaScript
regular-expression source over repository-relative paths, not a glob; use `.*` instead of `**`.
Unlisted changed files appear at the end of their layer.

Keep the Review Canvas id. A dirty Review is live-only; after committing and cleaning the checkout,
update that same Review and verify Porcelain bound it to the exact commit for History.
