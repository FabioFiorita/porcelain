# Tasks

Tasks are Porcelain's **daemon-wide** table: rows shared by every Project on that Environment.
They live in the daemon's own home (`$PORCELAIN_HOME/tasks/tasks.json`) and never enter a
repository. Coordination therefore outlives, precedes, and spans checkouts, so a Task about a
repo you have not cloned yet, or about two repos at once, still has a home.

**Tasks vs Review:** Tasks are work rows; Review is the daemon-root Canvas story with Intent,
Process, Execution, and Evidence. A Task is not a second Review.

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain`. Run it from **inside the
repo** and Tasks you create pick up that checkout's Project and Worktree references automatically;
outside a Porcelain-known repo the verbs still work, just without references.

- `~/.porcelain/porcelain tasks list` → every Task on this Environment, with its id, status, tags,
  and references.
- `~/.porcelain/porcelain tasks add --title <s> [--notes <s>] [--status todo|doing|done|blocked]
  [--tags a,b] [--link <url>] [--link-label <s>] [--attach <abs path>] [--project-id <s>]
  [--worktree-id <s>]` → capture a Task. `--attach` **copies** the file into the daemon's store, so
  the Task keeps its evidence even if the original moves.
- `~/.porcelain/porcelain tasks update --id <id> [--title <s>] [--notes <s>] [--status <s>]
  [--tags a,b]` → edit a row.
- `~/.porcelain/porcelain tasks done --id <id>` → shorthand for `--status done`.

## How to use it

- Capture follow-ups you discover mid-change with `tasks add` rather than leaving them in the
  conversation — that is the whole reason the table exists.
- Move a Task to `doing` when you start it and `done` when you finish, so the human sees progress
  without asking.
- Attach the artifact that explains the Task (a failing log, a screenshot) with `--attach`, and
  link the run or issue with `--link`. A Task that names its evidence is a Task the human can act
  on without you.
- The Environment is implicit: the CLI writes to the daemon whose `$PORCELAIN_HOME` it resolves.
  There is no cross-machine write from the CLI — that is the app's job, and it always names the
  Environment explicitly.
