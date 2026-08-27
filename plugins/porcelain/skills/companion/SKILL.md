---
name: companion
description: Use Porcelain's domain MCP tools to work with Canvases and templates, review comments, repository profiles, and user-run Actions. Use when the human asks to publish or inspect shared work, manage review feedback, shape the repository view, or propose a command for the human to run.
license: MIT
---

# Porcelain companion

Porcelain is the review layer around agent work. The daemon owns canonical state and the
browser, desktop, and mobile clients render it. Use the product's domain tools; do not read
daemon storage or call its HTTP API directly.

## The five entry points

Every call that works on a checkout takes `workspace`: the absolute path of the checkout (your
current working directory normally works) or `{projectId, worktreeId?}` for another checkout.
`porcelain_project` discovers those ids and is the only entry point that does not need a
workspace for `op: "list"`.

| Entry point | Operations | Use |
|---|---|---|
| `porcelain_project` | `list`, `get` | Discover Projects and Worktrees |
| `porcelain_canvas` | `list`, `get`, `create`, `update`, `delete`, `promote` | Author the shared surface; `review` is a Canvas template |
| `porcelain_comment` | `list`, `get`, `create`, `update`, `delete`, `reply`, `resolve`, `reopen` | Keep the complete review-comment loop in one place |
| `porcelain_profile` | `get`, `promote` | Read or promote manual project navigation choices |
| `porcelain_action` | `list`, `get`, `create`, `update`, `delete` | Author a command the human may run by clicking in Porcelain |

There is no context super-tool, separate Review or reply tool, generic promotion tool, terminal
tool, file tool, Git tool, or Action execution/trust tool. Each feature has one clear entry point.

## Canvas first for shared explanations

Use `porcelain_canvas` for any authored explanation, report, diagram, evidence record, or
handoff. A normal Canvas accepts Markdown/HTML files or a daemon-host directory. The `review`
template accepts structured `templateData` with a title, Why/How blocks, review layers, declared files, and Assets;
Evidence and Handoff are content inside that Canvas/template, not separate MCP domains.
Read [references/canvas.md](references/canvas.md) when authoring a Canvas, especially an HTML
bundle that needs portable layout and theme styling.

Private Canvases live in daemon state. `op: "promote"` copies one into the addressed checkout's
`.porcelain/canvases/<id>/` overlay. A tracked Canvas is canonical for that checkout and reads
through `get`/`list`; updates to it remain tracked, and `delete` removes the tracked bundle.
Promotion writes files but never stages or commits.

## Comments

`porcelain_comment` lists `status: "open"`, `"resolved"`, or `"all"` and keeps replies attached
to their parent. Use `reply` for an agent response, and `resolve`/`reopen` only when the human
has asked for that state change.

## Profiles and Actions

Pins, hides, and unhidden paths are manual file-tree choices and agents preserve them. `promote`
writes the existing portable project pins/hides to `.porcelain/project.json`. Story layers belong
to the individual Review Canvas and are authored with that Review's `templateData.layers`.

Actions are definitions only. Create and update the title, command, target, and optional lifecycle
kind. The MCP surface never runs, approves, trusts, or executes an Action. The human reads it and
starts it with a click in the app; command edits retain the app's internal approval safety state.

## Working rules

- Use `$companion` when the human requests Companion work or a Porcelain Canvas, comment, profile, or Action operation.
- Read open comments when the human asks for review feedback; request `status: "all"` when history matters.
- Never read or write `$PORCELAIN_HOME`, `.porcelain` files, or daemon APIs directly.
- Keep secrets out of Canvases, Actions, and profiles.
- Ordinary code changes follow the repository's root `AGENTS.md`; Porcelain writes are explicit product state, not a side effect of coding.
- Work in development playgrounds. Do not aim proof at production state or an unrelated real checkout.

Load the linked references only as needed. They are a progressive-disclosure aid, not additional
protocols.
