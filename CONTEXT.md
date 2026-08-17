# Porcelain domain context

Porcelain is the review layer for agent-created work: a one-window hub for reading what agents wrote and deciding whether to trust it, across multiple Environments. The Worktree is the core object — several are read side by side, because several agents run at once. It is not an agent runner; it provides the navigation, Git, Canvas, Tasks, and development-server surfaces around work that happens elsewhere.

## Workspace

**Environment**:
A machine and its Porcelain daemon that owns local filesystem, Git, terminals, projects, worktrees, and daemon-local Tasks. Environments may be local or remote and are distinguished in the UI by their identity and icon. When an Environment is offline, its projects, Worktrees, and Tasks are omitted from the live Hub rather than shown as stale data.
_Avoid_: System, host

**Project**:
An environment-local repository or workspace record. A repository present in more than one Environment remains operationally separate in each Environment, even when the Hub groups those records as one logical Project.
_Avoid_: Global project

**Worktree**:
A Git checkout representing one line of development inside a Project, and Porcelain's core object. Every Worktree is a first-class navigation target: the place where the developer inspects code, diffs, Git state, development servers, and Canvases. Several Worktrees are read side by side without opening a second window, because several agents work at once. Porcelain creates Worktrees, with the human choosing the branch and the destination on disk, and disposes of them by explicit confirmed choice. Each Worktree carries a Worktree profile.
_Avoid_: Thread, session

**Worktree profile**:
The pinned paths, hidden paths, and ordered Layers belonging to one Worktree. It expresses what this task needs to see and in what order, so a web change and a mobile change in one repository get a different tree and a different story. A profile is personal: two developers working on different parts of the same monorepo want different focus and different Layers, so a profile is never shared, never promoted into Git, and never inherited. It dies with its Worktree, because it describes one task and stale focus reads as deliberate. The full tree always stays reachable — hiding is focus, never access control. Porcelain provides the means to read and write profiles and never writes one on its own initiative; whether a profile is set when a Worktree is created is the user's instruction to their own agent.
_Avoid_: Filter, scope, workspace settings

**Layer**:
One named group in a Worktree profile's ordered sequence, matching a set of paths. Layers turn a set of changed files into a story that follows the application's own line — view, transport, controller, service, repository, schema, or whatever a given codebase actually has. Layers are declared, never inferred: a codebase with no declared Layers has no story order yet, and a changed file matching no Layer is still shown, plainly, at the end.
_Avoid_: Category, folder, tag

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
Agent-authored proof or context recorded inside a Canvas. Evidence includes structured checks, Results documents, visual records such as images and video, and the quantitative measures of a change — coverage delta, mutation score, complexity, new dead code. The agent computes every one of them and writes them in; Porcelain renders them and never runs a suite or an analyser itself. Numbers are reading triage — they say where attention should go, never whether the work is correct. Assets live in the owning Project store, and the user may explicitly promote the Canvas and its assets into tracked repo `.porcelain/` data.
_Avoid_: Screenshot gallery, quality gate, score

**Tasks**:
A daemon-owned, table-first, GitHub Projects-like data table for work across Projects. Each Environment daemon is authoritative for its own Tasks table. It supports configurable columns such as status and tags, with Project, Environment, and Worktree references available as fields. The Hub can aggregate Tasks from connected Environments; mutations always target an explicit daemon. Quick Add creates Tasks and can attach copied files or links. Saved views, filters, and alternate layouts may be added later without changing the data model.
_Avoid_: Per-repository kanban, project board, Board

**Action**:
A saved command scoped to a Project and run in a terminal against an explicitly selected Environment and Worktree. Most Actions are pressed by a human from the Hub's menu — a development server, a build, a reset. An Action may instead be marked to run when a Worktree is created or disposed of, making it that Project's setup or teardown; the explicit human act is creating or disposing of the Worktree, and no agent ever fires one. Actions and lifecycle hooks are one concept with one store, distinguished only by that marking. Every mutation requires an explicit target; the Hub never guesses which copy of a repository should run it.
_Avoid_: Agent-triggered automation, background job, separate hook concept

## Persistence boundaries

The daemon root under `$PORCELAIN_HOME` is the default source for private project data. It contains stable project records with Canvases, assets, Actions, and Worktree metadata; Tasks remain daemon-wide. A repo-local `.porcelain/` is optional and is created only when the user explicitly promotes portable Canvases or overrides into Git. A promoted Canvas is the tracked source of truth and the daemon indexes it rather than maintaining a second editable copy. Tracked overrides may express project defaults and Worktree-specific settings; personal UI pins remain client-local. The environment daemon owns live operational state such as Worktrees, Git state, terminals, development servers, and Tasks storage. Terminal and development-server processes continue across Viewer detachment, Worktree switching, client disconnects, and window closure until explicitly stopped. The client owns presentation state such as tabs, splits, personal pins, ordering, and preferences. Each daemon owns its private store; the Hub groups equivalent Projects across Environments but does not synchronize private Canvas data automatically. Existing legacy companion files are inert and are not read by the product.

## Retired surfaces

**Project Notes**:
The former repo-level freeform scratchpad. It is excluded from the new Hub model because Tasks carry ongoing work.
_Avoid_: Notes as a core surface

**Terminal image paste**:
Clipboard image or file transfer into a Terminal session. It is excluded from the new Hub model and is distinct from Evidence images and video.
_Avoid_: Evidence asset
