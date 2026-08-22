# Tasks

Tasks are Porcelain's **daemon-wide** table: rows shared by every Project on that Environment.
They live in the daemon's own home and never enter a repository, so coordination outlives,
precedes, and spans checkouts — a Task about a repo you have not cloned yet, or about two repos
at once, still has a home.

**Tasks vs Canvas:** Tasks are durable work rows; a Canvas is the authored story with optional
templates, Evidence, and Handoff. A Task is not a second Canvas.

`porcelain_task` owns the whole board and takes `workspace` — the absolute path of the checkout
you are standing in (your working directory is the right answer), or `{projectId, worktreeId?}`
when you mean a different checkout or the daemon runs on another host.

## Read

```jsonc
// The open board: short id, title, status, notes, tags, links, references, attachments
porcelain_task { "op": "list", "workspace": "/abs/path/to/checkout" }

// …including the finished ones
porcelain_task { "op": "list", "workspace": "…" }

// One Task in full
porcelain_task { "op": "get", "workspace": "…", "id": "T-18" }

// Which checkouts this daemon has open, with their projectId / worktreeId
porcelain_project { "op": "list" }
```

Every Task comes back with `id` (the short id — `T-18` — the same one the human says and the app
shows) and `uuid`. Either is accepted anywhere an id is asked for.

Each attachment carries `hostPath`: the absolute path of the copied file **on the daemon host**.
When the daemon is your machine, read that path directly — that is how you look at the screenshot
the human attached. When the daemon is remote, treat it as a name only.

## Write

```jsonc
// Create
porcelain_task { "op": "create", "workspace": "…", "title": "Fix the pairing timeout",
                 "notes": "…markdown…", "status": "todo", "tags": ["daemon"] }

// Start it, finish it
porcelain_task { "op": "update", "workspace": "…", "id": "T-18", "status": "doing" }
porcelain_task { "op": "update", "workspace": "…", "id": "T-18", "status": "done",
                 "link": "https://github.com/o/r/pull/7", "linkLabel": "PR #7" }

// Several rows, one change
porcelain_task { "op": "update", "workspace": "…", "id": "T-3", "status": "done" }
```

- `link` **adds** to the links already on the Task; `links` replaces the whole list.
- `notes`, `tags` and `title` replace what is there.
- `attach` takes an absolute path and **copies** the file into the daemon's store (local daemon
  only — the path is read on the daemon host). `file` / `folder` are live worktree-relative
  pointers, not copies.
- A Task you create picks up the Project and Worktree of the `workspace` you passed.

## How to use it

- Capture follow-ups you discover mid-change rather than leaving them in the conversation — that
  is the whole reason the table exists.
- Move a Task to `doing` when you start and `done` when you finish, so the human sees progress
  without asking. Attach the PR with `link` as you close it.
- Attach the artifact that explains the Task (a failing log, a screenshot). A Task that names its
  evidence is a Task the human can act on without you.
- The Environment is implicit: you are talking to one daemon, and it owns the board.

## Do not go around the tools

If you catch yourself about to read `$PORCELAIN_HOME/tasks/tasks.json`, open a file under
`…/tasks/attachments/`, or call the daemon's HTTP API with `curl`, stop. Those are private daemon
state; a write that skips the daemon is invisible to the app and to every other client, and a read
that skips it will drift.

If the tools genuinely cannot do what you need, that is a bug in the tool — record it with
`porcelain_task` (tag `mcp`) and say so in your report.
