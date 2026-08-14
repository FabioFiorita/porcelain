# Porcelain domain context

Porcelain is a one-window development hub for inspecting and coordinating agent-created work across multiple environments. In the current direction it is not a chat-based agent runner; it provides the workspace, Git, terminal, development-server, Tasks, and agent-authored Canvas surfaces around that work. A future global Terminal may host tools such as Herdr, but that is outside the current version.

## Workspace

**Environment**:
A machine and its Porcelain daemon that owns local filesystem, Git, terminals, projects, worktrees, and daemon-local Tasks. Environments may be local or remote and are distinguished in the UI by their identity and icon. When an Environment is offline, its projects, Worktrees, and Tasks are omitted from the live Hub rather than shown as stale data.
_Avoid_: System, host

**Project**:
An environment-local repository or workspace record. A repository present in more than one Environment remains operationally separate in each Environment, even when the Hub groups those records as one logical Project.
_Avoid_: Global project

**Worktree**:
A Git checkout representing one line of development inside a Project. Every Git Worktree is a first-class navigation target: it is the place where the developer inspects code, diffs, Git state, development servers, and the agent-authored Canvas surface. Porcelain discovers and displays Worktrees and may help create them, but has no destructive Delete Worktree control in v1; deletion remains an explicit terminal or agent operation.
_Avoid_: Thread, session

**Hub**:
The single application shell that keeps known Environments connected and exposes their Projects and Worktrees without opening a separate window. Switching context preserves the Viewer tabs and split panes belonging to the previous Worktree.
_Avoid_: Window per worktree

**Viewer**:
The central tabbed and splittable surface where a developer opens diffs, files, Tasks, terminals, Canvases, and other project content. Every tab retains its explicit Environment, Project, and Worktree target, so tabs from multiple machines may coexist without being silently retargeted. With no selection it shows an all-Environment Home; Project and Worktree selections replace that with progressively narrower status summaries. Switching Worktrees does not kill its open Viewer state. Restoring tabs and splits after app restart is optional client polish, not a requirement for the architecture.
_Avoid_: Editor

## Coordination and proof

**Canvas**:
A human-facing HTML document bundle written by an agent to explain intent, process, execution, and evidence. Private Canvas bundles live in the daemon-owned Project store; an explicitly promoted bundle may live under repo `.porcelain/canvases/` and becomes tracked source of truth. Private and promoted media/evidence assets follow the same ownership choice. A Worktree may contain many Canvases; the Viewer shows the selected Canvas, while the right sidebar lists the available Canvases. A Canvas may contain multiple tabs and may be updated freely by agents before, during, or after work. It may be freeform or use the Review template, and is distinct from the Markdown channel agents use to communicate with tools. Canvas HTML is interactive: links, internal navigation, and agent-authored controls must work inside the Viewer. The Viewer allows in-document scripts inside a sandbox, permits safe relative asset access, keeps internal links inside the Canvas, and sends external navigation outside the Canvas. Canvases are agent-owned and read-only to humans in v1. Shipped agent skills should encourage HTML for human-friendly explanation without forbidding Markdown.
_Avoid_: After-work Review

**Review**:
The default structured Canvas template with four explicit tabs: Intent, Process, Execution, and Evidence. Review is a template, not a lifecycle phase or a restriction on when a Canvas may be used.
_Avoid_: The only proof surface

**Evidence**:
Agent-authored proof or context recorded inside a Canvas. Evidence includes structured checks, Results documents, and visual records such as images and video stored in the owning Project store; the user may explicitly promote the Canvas and its assets into tracked repo `.porcelain/` data. Porcelain visualizes those assets but does not decide how the agent records them.
_Avoid_: Screenshot gallery

**Tasks**:
A daemon-owned, table-first, GitHub Projects-like data table for work across Projects. Each Environment daemon is authoritative for its own Tasks table. It supports configurable columns such as status and tags, with Project, Environment, and Worktree references available as fields. The Hub can aggregate Tasks from connected Environments; mutations always target an explicit daemon. Quick Add creates Tasks and can attach copied files or links. Saved views, filters, and alternate layouts may be added later without changing the data model.
_Avoid_: Per-repository kanban, project board, Board

**Action**:
A saved command scoped to a Project and aggregated into the Hub's top-corner menu for explicit human execution against a selected Environment and Worktree. Every mutation requires an explicit target; the Hub never guesses which copy of a repository should run it.
_Avoid_: Automatically running task, agent action

## Persistence boundaries

The daemon root under `$PORCELAIN_HOME` is the default source for private project data. It contains stable project records with Canvases, assets, Actions, and Worktree metadata; Tasks remain daemon-wide. A repo-local `.porcelain/` is optional and is created only when the user explicitly promotes portable Canvases or overrides into Git. A promoted Canvas is the tracked source of truth and the daemon indexes it rather than maintaining a second editable copy. Tracked overrides may express project defaults and Worktree-specific settings; personal UI pins remain client-local. The environment daemon owns live operational state such as Worktrees, Git state, terminals, development servers, and Tasks storage. Terminal and development-server processes continue across Viewer detachment, Worktree switching, client disconnects, and window closure until explicitly stopped. The client owns presentation state such as tabs, splits, personal pins, ordering, and preferences. Each daemon owns its private store; the Hub groups equivalent Projects across Environments but does not synchronize private Canvas data automatically. Existing personal data will be migrated once to these new locations and semantics; compatibility with the retired Board, Notes, and active-Review model is not a product requirement after cutover.

## Retired surfaces

**Project Notes**:
The former repo-level freeform scratchpad. It is excluded from the new Hub model because Tasks carry ongoing work.
_Avoid_: Notes as a core surface

**Terminal image paste**:
Clipboard image or file transfer into a Terminal session. It is excluded from the new Hub model and is distinct from Evidence images and video.
_Avoid_: Evidence asset
