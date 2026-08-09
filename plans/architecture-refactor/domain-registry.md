# Canonical domain registry

This registry is the naming authority for the architecture migration. It turns Decision 013 into a
single lookup that specifications, target paths, contract names, lints, and contributor docs use.
It does not preserve the current aliases as supported target vocabulary.

## Product domains

| Key | Owns | Does not own | Current terms to remove or relocate |
| --- | --- | --- | --- |
| `projects` | Known Projects, opening/selecting a Project, recent Projects, and Project discovery | Files browsing inside an open Project, Git worktrees, generic settings | `repo`, `repos`, and mobile `workspace` when they mean a Porcelain Project |
| `files` | Project tree, file reads/writes, previews, pins, hidden paths, scope, and filesystem watches | Search, diff/history, Viewer rendering | global `fs`, tree behavior hidden in shell, Search descriptors colocated under Files |
| `git` | Working tree, staging, commits, diffs, history, branches, worktrees, and Git read state | Project identity, Review lifecycle, generic process execution | `changes` and `history` as owners; Review-inbox behavior currently exposed from the Git router |
| `search` | File-name, text, and code search intentions and result semantics | Files tree traversal exposed to users, Git history browsing, search UI chrome | Search procedures in the Files router and mobile Files procedure catalog |
| `review` | Active and archived Reviews, Intent/Execution/Evidence reading, comments, reviewed marks, Review inbox, and Review exploration | Git state, Board storage, generic document rendering | `feature`, `featureView`, `featureReading`, and other feature-era public names |
| `board` | Board cards, columns/order, card lifecycle, and Board persistence | Review completion or handoff orchestration merely because it affects a card | Board descriptors under mobile Review and Board behavior hidden in Review workflows |
| `actions` | Saved Actions, ordering, trust policy, and preparing an Action run | PTY session lifecycle and terminal presentation | Action procedures under Terminal and Action UI treated as terminal ownership |
| `terminal` | PTY sessions, attachment, input/output, resize, scrollback, cleanup, and stream recovery | Saved-command policy, arbitrary process helpers, terminal renderer implementation | Action procedures under Terminal; generic session messages that hide terminal stream semantics |
| `project-data` | Repo-local companion storage policy, notes, dispositions, layers, format ownership, atomicity, and corruption policy | Every domain object stored under `.porcelain`, Settings UI, product behavior of stored domains | `settings` or `companion` as owners; mixed writes hidden in unrelated routers |
| `remote` | Daemon identity, authentication, pairing, endpoints, exposure, connectivity, protocol/session health, and public error transport | Product-domain queries, Electron window behavior, platform credential storage implementation | connection/network settings as a generic Settings owner; legacy endpoint/icon shapes |

The title-case product nouns are **Project**, **Files**, **Git**, **Search**, **Review**, **Board**,
**Actions**, **Terminal**, **Project Data**, and **Remote**. Code paths and identifiers use the keys
above. “Repository” remains valid for a Git repository and “workspace” remains valid only for a
real workspace concept; neither is a synonym for Project.

## Supporting regions

Supporting regions do not become an eleventh product domain.

| Region | Responsibility |
| --- | --- |
| `shell` | Navigation, windows, tabs, panes, overlays, and application chrome |
| `viewer` | Web/mobile rendering of files, diffs, and authored documents |
| `settings` | Presentation that assembles controls owned by domains |
| `ui` | Generic visual primitives and tokens |
| `daemon-composition` | Construction, transport setup, authentication middleware, logging, and lifecycle |
| `desktop` | Electron main/preload integration, windows, updates, packaging, and local daemon lifecycle |
| `native` | Mobile-only platform integration, including the terminal renderer |
| `infrastructure` | Cross-domain technical drivers with no product policy, such as raw filesystem/process helpers |

Supporting code may adapt or compose product domains. It does not absorb product rules because the
same mechanism is used by several domains.

## Package trail

A domain uses the same key at every runtime boundary where it participates:

```text
packages/contracts/src/<domain>/
apps/daemon/src/features/<domain>/
packages/client-runtime/src/<domain>/
apps/web/src/features/<domain>/
apps/mobile/src/features/<domain>/
apps/cli/src/<domain>/                  # only when the CLI exposes that domain
```

A missing stop is normal. An empty directory or layer created for symmetry is not.

## Naming rules

- Public intentions use verb-object names: `writeFile`, `completeReview`, `createWorktree`.
- The operation factory is `createWriteFile`; its bound operation is `writeFile`.
- Operation types are `WriteFileInput`, `WriteFileResult`, and `WriteFileFailure`.
- Capability names describe a cohesive owned ability: `WorkspaceFiles`, `ProjectGit`, `ReviewStore`.
- Contract schemas use the same intention: `writeFileInputSchema`, `WriteFileInput`.
- Query identities and notifications use domain-owned nouns, not router or UI folder names.
- Routers are `<domain>.router.ts`; a domain public boundary is `index.ts`.
- Generic containers such as `service.ts`, `manager.ts`, `utils.ts`, `helpers.ts`, `common.ts`,
  `types.ts`, and `constants.ts` are forbidden unless the filename names the owned concept.

## Ownership test

Every inventoried behavior receives exactly one product domain or supporting region. If two domains
must change for one intention, the intention's domain owns a coordinating operation and names the
other domain's narrow capability. If no owner is honest, architecture discussion precedes a spec;
an execution agent does not create a generic workflow service.
