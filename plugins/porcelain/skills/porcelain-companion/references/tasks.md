# Tasks

Tasks are Porcelain's **daemon-wide** table: rows shared by every Project on that Environment.
They live in the daemon's own home (`$PORCELAIN_HOME/tasks/tasks.json`) and never enter a
repository. Coordination therefore outlives, precedes, and spans checkouts, so a Task about a
repo you have not cloned yet, or about two repos at once, still has a home.

**Tasks vs Review:** Tasks are work rows; Review is the daemon-root Canvas story with Intent,
Process, Execution, and Evidence. A Task is not a second Review.

Talk to Porcelain through the `porcelain` MCP tools. Every call takes `workspace` — the absolute
path of the checkout, or `{projectId, worktreeId}` when the daemon runs on another host. A Task you
create picks up that checkout's Project and Worktree references automatically.

- `porcelain_context` with `include: ["tasks"]` → every Task on this Environment, with its short id (`T-18`),
  UUID, status, tags, and references.
- `porcelain_context` with `include: ["tasks"]` and `taskId` → one Task: notes, file/folder tags, and
  absolute attachment paths so you can read the pictures.
- `porcelain_task` with `title` and no `id` [`notes`, `status: todo|doing|done|blocked`,
  [--tags a,b] [--link <url>] [--link-label <s>] [--attach <abs path>] [--file <path>]
  [--folder <path>] [--project-id <s>] [--worktree-id <s>]` → capture a Task. `--attach` **copies**
  the file into the daemon's store. `--file` / `--folder` are live pointers into the worktree
  (not copies) and need a Project and Worktree.
- `porcelain_task` with an `id` [`title`, `notes`, `status`,
  [--tags a,b]` → edit a row.
- `porcelain_task` with an `id` and `status: "done"` → close it.

## How to use it

- Capture follow-ups you discover mid-change with `porcelain_task` rather than leaving them in the
  conversation — that is the whole reason the table exists.
- Move a Task to `doing` when you start it and `done` when you finish, so the human sees progress
  without asking.
- Attach the artifact that explains the Task (a failing log, a screenshot) with `--attach`, and
  link the run or issue with `--link`. A Task that names its evidence is a Task the human can act
  on without you.
- The Environment is implicit: the CLI writes to the daemon whose `$PORCELAIN_HOME` it resolves.
  There is no cross-machine write from the CLI — that is the app's job, and it always names the
  Environment explicitly.
