# 013 — Use ten canonical product domains

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

Current router, store, hook, component, CLI, and settings names mix product intentions with technical
mechanisms and presentation surfaces. `repos.ts` owns project selection and file navigation;
`files.ts` owns file behavior and search; `settings.ts` owns Review layers, Files scope, Git models,
notes, and companion-data policy; `terminal.ts` owns both PTYs and saved Actions. Treating those files
as domain boundaries would preserve the discoverability problem under new directories.

Porcelain also has established product language that differs from historical code and wire names:
Project versus repo, Review versus feature, and Changes/History versus their shared Git behavior. A
canonical map must preserve meaningful product ownership without turning screens or adapters into
top-level business domains.

## Decision

Porcelain has ten canonical product domains: `projects`, `files`, `git`, `search`, `review`, `board`,
`actions`, `terminal`, `project-data`, and `remote`.

## Domain map

| Domain key | Product ownership | Existing aliases and subfeatures |
|---|---|---|
| `projects` | Opening, selecting, remembering, and identifying a project | repo, repository, workspace, recent repos |
| `files` | Tree navigation, reading, writing, path operations, previews, hide/pin scope | file tree, repo scope, workspace files |
| `git` | Working tree, diffs, staging, commits, history, branches, and worktrees | Changes, History, source control |
| `search` | File, text, and code search across a project | file finder, content search, grep |
| `review` | Active and archived Review, Intent, Execution, Evidence, comments, reviewed marks, flow, and exploration | feature, feature view, review set, layers |
| `board` | Project queue and card lifecycle | todo, doing, done |
| `actions` | Saved human-run commands and machine-local trust | saved commands |
| `terminal` | Daemon-owned PTYs, attachment, streams, roster, naming, and pasted assets | sessions, shells |
| `project-data` | Project companion storage lifecycle, notes, Git disposition, migration, and visibility policy | Data settings, companion data |
| `remote` | Environments, daemon identity, pairing, access, LAN, Tailnet, Funnel, and sharing | connection, network, authorized clients |

The target domain registry records these exact keys. Display labels may use natural singular or
plural grammar without inventing another architectural key.

## Ownership clarifications

- Product language is **Project**. Current `repo`, `repository`, `repoPath`, and `openRepoPath` are
  inventory aliases until the pre-launch compatibility decision settles whether they are replaced or
  retained at external boundaries.
- A Git worktree is a Git-owned checkout associated with a Project, not a synonym for Project.
- Changes and History are presentation surfaces of `git`, not separate server domains.
- Review Inbox belongs to `review` because the intention is reviewing other work, even though it
  queries Git worktrees.
- Raw status, diff, staging, commit, branch, history, and worktree mechanics belong to `git`.
- Flow layers, grouped Review reading, reviewed marks, Intent, Evidence, comments, and Explore belong
  to `review`.
- Search owns the search intention even when its adapter uses Git grep or filesystem traversal.
- Hide and pin scope belongs to `files` because it determines project-file navigation and visibility.
- Saved Actions remain separate from `terminal`: Actions define and trust commands; Terminal executes
  them through an explicit cross-domain workflow.
- Notes and project companion Git-disposition policy belong to `project-data`.
- Historical `feature` concepts belong to `review`; there is no second Feature domain.
- “Companion” is too overloaded to serve as a domain key because it names a UI panel, a Settings tab,
  and repo-local project data.

## Current router decomposition

Current routers split into target owners as follows:

```text
repos.ts
├── projects: open, recent, browse
└── files: tree, scope, pins

files.ts
├── files: read, write, path operations, preview
└── search: file, text, and code search

git.ts
├── git: source-control behavior
└── review: Review Inbox orchestration over Git worktree capabilities

review.ts
└── review

settings.ts
├── git: commit models
├── review: layers
├── files: scope
└── project-data: notes and dispositions

terminal.ts
├── actions
└── terminal

daemon.ts + network.ts
└── remote
```

Procedure-by-procedure ownership is recorded in the exhaustive inventory. This decision establishes
the domain boundary and prevents the current router file from deciding ownership by default.

## Supporting regions

These are necessary architecture but not product domains:

- `shell` owns client navigation, panes, tabs, overlays, and window composition;
- `viewer` owns shared presentation mechanics for files, diffs, Markdown, HTML, and Review documents;
- `settings` aggregates controls whose behavior remains owned by product domains;
- `ui` owns generic visual primitives and tokens;
- filesystem, network, transport, persistence drivers, and process execution are infrastructure
  capabilities;
- daemon is a runtime and composition boundary;
- desktop owns native shell integration;
- contracts, client-runtime, and shared are package roles.

A supporting region can have clear internal ownership and tests without becoming a product domain.
Settings may present Review, Files, Project Data, Git, and Remote controls without owning their
business behavior.

## Product intention versus mechanism

```text
Search project content  → search       → Git grep or filesystem adapter
Show Review Inbox       → review       → Git worktree capability
Run saved Action        → actions      → Terminal capability
Display Changes         → git          → Git process adapter
Manage companion data   → project-data → filesystem and Git-exclude adapters
```

The product intention selects the operation owner. The technical mechanism becomes an injected
capability or adapter and cannot claim ownership merely because several domains use it.

## Rationale

- The map follows stable product intentions rather than the current horizontal implementation.
- Every sidebar concern has a predictable domain home without making every screen a server domain.
- Ambiguous cross-domain workflows receive explicit owners.
- Technical capabilities remain reusable without becoming grab-bag services.
- The map is small enough to understand and complete enough to inventory all public behavior.
- Project Data and Remote name cohesive cross-surface product responsibilities that current Settings,
  daemon, network, and companion files otherwise scatter.

## Rejected alternatives

- **Use current router names as domains.** Several routers already combine unrelated responsibilities.
- **Make every sidebar tab a domain.** Changes and History would duplicate Git ownership, while
  Settings would own behavior from many domains.
- **Use Git as only infrastructure.** Source-control behavior is itself a major product capability,
  not merely process execution.
- **Put Actions inside Terminal.** Command definition and trust have a different lifecycle from PTY
  execution.
- **Put all repo-local files in Project Data.** Storage location does not transfer Board, Review,
  Actions, Files, or other product ownership.
- **Create a Companion domain.** Its three product meanings would make navigation less precise.
- **Create domains for Shell, Viewer, and Settings.** They are composition or presentation regions
  spanning domain-owned behavior.

## Consequences

- Current routers, stores, hooks, component directories, and contract catalogs must be mapped rather
  than moved wholesale.
- Client Changes and History surfaces converge under Git semantic ownership while retaining distinct
  UI regions where useful.
- Review operations may coordinate Git and Files capabilities without importing their internals.
- Project Data owns cross-cutting storage policy, not the content semantics of every `.porcelain`
  file.
- The inventory must identify supporting-region code separately so it is not forced into an
  artificial product domain.
- Canonical naming at external and persisted boundaries remains subject to the pre-launch clean-break
  decision added after this map was accepted.

## Enforcement and proof

The architecture registry uses only these ten product-domain keys unless a later accepted decision
adds, merges, or renames one. Migrated feature paths, public entry points, and dependency checks use
the registry rather than discovering domains from directories.

The exhaustive inventory must assign every procedure, contract, CLI noun, persisted file, daemon
module, client feature, and cross-domain workflow to one product domain or one named supporting
region. An unowned item blocks specification delegation; an item with multiple owners requires an
explicit coordinating operation.
