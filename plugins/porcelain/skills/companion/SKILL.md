---
name: companion
description: Use Porcelain's domain MCP tools for Canvases, review comments, repository profiles, and user-run Actions. Use when the human asks to use or set up Porcelain, mentions Porcelain while starting repository work, wants shared review material, asks for review feedback, wants the repository view shaped, or needs a command curated for them to run.
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
| `porcelain_canvas` | `list`, `get`, `create`, `update`, `delete`, `promote` | Author the shared surface; `decision` is the semantic template |
| `porcelain_comment` | `list`, `get`, `create`, `update`, `delete`, `reply`, `resolve`, `reopen` | Keep the complete review-comment loop in one place |
| `porcelain_profile` | `get`, `promote` | Read or promote manual project navigation choices |
| `porcelain_action` | `list`, `get`, `create`, `update`, `delete` | Author a command the human may run by clicking in Porcelain |

There is no context super-tool, separate Review or reply tool, generic promotion tool, terminal
tool, file tool, Git tool, or Action execution/trust tool. Each feature has one clear entry point.

## Canvas first for shared explanations

Use `porcelain_canvas` for authored explanations and decisions. The semantic `decision` template
is the structured path: one concise `templateData` payload supplies context, options, criteria,
assessments, recommendation, and an optional recorded decision while Porcelain owns presentation.
Update the returned Canvas id as the decision develops, then add `decision` when the human chooses.
Read [references/canvas.md](references/canvas.md) before authoring or updating a Canvas.

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
writes the existing portable project pins/hides to `.porcelain/project.json`.

Actions are definitions only. Create and update the title, command, target, and optional lifecycle
kind. The MCP surface never runs, approves, trusts, or executes an Action. The human reads it and
starts it with a click in the app; command edits retain the app's internal approval safety state.

## Starting work with Porcelain

When the human asks to use or set up Porcelain for repository work, inspect the project navigation
profile before substantial implementation and preserve its manual pins and hides. When the work
contains a material choice, create one Decision Canvas and keep updating that id. Read the
[profile reference](references/profile.md) before profile operations. The product UI shows the
result directly—it is not a prompt delivery mechanism.

## Working rules

- Use `$companion` when the human asks to use Porcelain in repository work or requests a Canvas,
  comment, profile, or Action operation.
- Read open comments when the human asks for review feedback; request `status: "all"` when history matters.
- Never read or write `$PORCELAIN_HOME`, `.porcelain` files, or daemon APIs directly.
- Keep secrets out of Canvases, Actions, and profiles.
- Ordinary code changes follow the repository's root `AGENTS.md`; Porcelain writes are explicit product state, not a side effect of coding.
- Work in development playgrounds. Do not aim proof at production state or an unrelated real checkout.

Load the linked references only as needed. They are a progressive-disclosure aid, not additional
protocols.
