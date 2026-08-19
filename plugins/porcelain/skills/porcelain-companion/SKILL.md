---
name: porcelain-companion
description: Drive Porcelain's Review Canvas, Tasks, Actions, profiles, review comments, and explicit overlays through MCP tools. Use when the human asks to publish or inspect a Review, manage a profile, answer a comment, record Tasks or Actions, promote daemon data, or close the evidence loop.
license: MIT
---

# Porcelain companion

Porcelain is an explicit product surface procedure where agent work becomes trusted work. The
daemon owns the canonical state; the app and browser render it. Repo-local companion files are
explicit tracked overlays, not a live Review database.

## Start with the tools

The `porcelain` MCP server runs on the daemon. Eight tools, and **`porcelain_context` first** —
it resolves the workspace and hands back the Review, the human's open comments, and the files
they have marked reviewed.

Every tool takes `workspace`: the absolute path of the checkout you are working in — your own
working directory is normally the right value, and any directory inside the checkout resolves.
Pass `{projectId, worktreeId}` to act on a **different** checkout than the one you are standing
in, or when the daemon runs on another host where your local path means nothing;
`porcelain_context` with `include: ["projects"]` lists those ids.

If a call reports that the checkout is not open in Porcelain, the refusal names the Projects that
are open. Pick one of those or ask the human to open the repository in the app — do not guess
another path.

**Never go around these tools.** Do not read or write `$PORCELAIN_HOME` (`tasks.json`,
`attachments/`, canvases) and do not `curl` the daemon's HTTP API. The daemon is the single
writer; anything that skips it is invisible to the app and to every other client. If a tool
genuinely cannot do what the work needs, that is a bug in the tool: record it with
`porcelain_task` and say so in your report.

## References

Load the reference that matches the task:

```text
references/review.md              Review Canvas: Intent · Process · Execution · Evidence
references/tasks.md               daemon-wide Tasks
references/actions.md             Project Actions (definitions; the human runs them)
references/profile.md             project baseline and worktree profile override
references/git-visibility.md      private state and tracked Canvas/project overlays
references/worktrees.md           targeting a Worktree from a harness checkout
references/sync-environments.md   daemon/Project setup across environments
```

## The tools

| Tool | Use it to |
|---|---|
| `porcelain_context` | Read the Review, open comments, reviewed marks; ask for `tasks`, `actions`, `canvases`, `projects` |
| `porcelain_profile` | Read or replace the project profile or worktree override |
| `porcelain_review` | Declare the Review — `replace`, `append` files, or `clear` |
| `porcelain_task` | Create a Task (no `id`), update one (`id`, short id like `T-18`), or move several (`ids`) |
| `porcelain_action` | Save or delete an Action the human will run |
| `porcelain_canvas` | Publish a Canvas bundle from a local directory |
| `porcelain_promote` | Move private daemon data into the checkout as tracked files |
| `porcelain_reply` | Answer a review comment the human left |

## The loop

1. Call `porcelain_context`. Read the human's open comments before doing anything else — they
   are the reason this product exists, and they are the one input you cannot infer.
2. For an intentionally published unit, declare the Review with `porcelain_review`. A name and a
   thesis alone is a valid Intent-first start, before a file is listed.
3. Keep Intent (thesis), Process (sections), and Execution (declared files) current as the work
   changes. The Review is a Canvas with four tabs, not a queue and not an editor.
4. Answer comments with `porcelain_reply` as you address them. You cannot resolve or delete a
   comment; the human closes their own loop.
5. Close the loop with real Evidence: checks, Results documents, and an image gallery.
6. Record follow-ups that are outside the Canvas story as daemon-owned Tasks.

## The Task loop

When the human hands you a board rather than a Review:

1. `porcelain_context` with `include: ["tasks"]` — the whole open board, with each Task's short
   id, notes, links and attachment paths. Add `includeDone: true` to see what is already finished.
2. Reading a Task's picture is a file read of the `hostPath` the tool handed you, when the daemon
   is this machine. Never reach into the attachment store by hand.
3. `porcelain_task` with `id` and `status: "doing"` when you pick a Task up; `status: "done"` plus
   `link` for the PR when you finish. `ids` applies one change to several rows.
4. New work you discover is a new Task (`porcelain_task` with a `title`), not a line in the chat.

See [references/tasks.md](references/tasks.md) for the full contract.

## Rules

- Ordinary code edits follow root AGENTS.md; they do not create, clear, or complete a Review.
- Create or clear a Review only when the human requests Companion work or the agent deliberately
  publishes a Review. Do not clear another active Review automatically.
- Complete Evidence validation before claiming an intentionally published Review complete.
- Clear or replace a Review only when the human explicitly requests replacement.
- A Task is a daemon-wide work row; it is not a Review and is not a per-repo board.
- Actions are definitions. Never invent an execute verb or bypass the human acceptance gate. An
  Action you save arrives **untrusted**: the human approves the command text before it can run,
  and editing a command drops that approval again. Do not ask them to pre-approve it.
- You may answer a review comment. You may not resolve or delete one.
- Hide and pin through the app's Files surface; project defaults are private daemon state until an
  explicit `porcelain_promote` with `what: "overrides"` writes `.porcelain/project.json`. Promote
  a Canvas deliberately when the team should receive it in git; promotion never commits.
- Keep secrets out of Canvas, Tasks, Actions, and project overrides.
- Work in an isolated Playground for development daemons. Never aim proof at production state or a
  real checkout.

For the full Review Canvas procedure, read [references/review.md](references/review.md).
