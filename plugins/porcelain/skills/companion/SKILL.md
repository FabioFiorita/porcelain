---
name: companion
description: Use Porcelain's domain MCP tools to work with Canvases and templates, review comments, Tasks, repository profiles, and user-run Actions. Use when the human asks to publish or inspect shared work, manage review feedback, carry work across chats, shape the repository view, or propose a command for the human to run.
license: MIT
---

# Porcelain companion

Porcelain is the review layer around agent work. The daemon owns canonical state and the
browser, desktop, and mobile clients render it. Use the product's domain tools; do not read
daemon storage or call its HTTP API directly.

## The six entry points

Every call that works on a checkout takes `workspace`: the absolute path of the checkout (your
current working directory normally works) or `{projectId, worktreeId?}` for another checkout.
`porcelain_project` discovers those ids and is the only entry point that does not need a
workspace for `op: "list"`.

| Entry point | Operations | Use |
|---|---|---|
| `porcelain_project` | `list`, `get` | Discover Projects and Worktrees |
| `porcelain_canvas` | `list`, `get`, `create`, `update`, `delete`, `promote` | Author the shared surface; `review` is a Canvas template |
| `porcelain_comment` | `list`, `get`, `create`, `update`, `delete`, `reply`, `resolve`, `reopen` | Keep the complete review-comment loop in one place |
| `porcelain_task` | `list`, `get`, `create`, `update`, `delete` | Track durable work, status, links, files, and attachments |
| `porcelain_profile` | `get`, `set`, `clear`, `promote` | Manage pins, hides, unhidden paths, and story layers |
| `porcelain_action` | `list`, `get`, `create`, `update`, `delete` | Author a command the human may run by clicking in Porcelain |

There is no context super-tool, separate Review or reply tool, generic promotion tool, terminal
tool, file tool, Git tool, or Action execution/trust tool. Each feature has one clear entry point.

## Canvas first for shared explanations

Use `porcelain_canvas` for any authored explanation, report, diagram, evidence record, or
handoff. A normal Canvas accepts Markdown/HTML files or a daemon-host directory. The `review`
template accepts structured `templateData` with a name, thesis, declared files, and sections;
Evidence and Handoff are content inside that Canvas/template, not separate MCP domains.

Private Canvases live in daemon state. `op: "promote"` copies one into the addressed checkout's
`.porcelain/canvases/<id>/` overlay. A tracked Canvas is canonical for that checkout and reads
through `get`/`list`; updates to it remain tracked, and `delete` removes the tracked bundle.
Promotion writes files but never stages or commits.

## Comments and Tasks

`porcelain_comment` lists `status: "open"`, `"resolved"`, or `"all"` and keeps replies attached
to their parent. Use `reply` for an agent response, and `resolve`/`reopen` only when the human
has asked for that state change. `porcelain_task` is daemon-wide: use `get` for a short id such
as `T-18`, `update` for status moves, and preserve links/path references/attachments when adding
one field.

## Profiles and Actions

Profiles are whole-document writes: call `get` first, then `set` with the complete project or
worktree shape. `promote` writes only portable project pins/hides to `.porcelain/project.json`;
private story layers and worktree overrides do not travel through Git.

Actions are definitions only. Create and update the title, command, target, and optional lifecycle
kind. The MCP surface never runs, approves, trusts, or executes an Action. The human reads it and
starts it with a click in the app; command edits retain the app's internal approval safety state.

## Working rules

- Use `$companion` when the human requests Companion work or a Porcelain Canvas, comment, Task, profile, or Action operation.
- Read open comments when the human asks for review feedback; request `status: "all"` when history matters.
- Never read or write `$PORCELAIN_HOME`, `.porcelain` files, or daemon APIs directly.
- Keep secrets out of Canvases, Tasks, Actions, and profiles.
- Ordinary code changes follow the repository's root `AGENTS.md`; Porcelain writes are explicit product state, not a side effect of coding.
- Work in development playgrounds. Do not aim proof at production state or an unrelated real checkout.

Load the linked references only as needed. They are a progressive-disclosure aid, not additional
protocols.
