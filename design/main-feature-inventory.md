# Porcelain `main` (v0.64.0): feature inventory

Produced read-only from `main` via git plumbing, to decide what the rebuild keeps.
Size: S = small file/under ~100 lines, M = a few files or 100–400 lines, L = many files or daemon + client + contract work.

`main` is a pnpm monorepo: headless Node **daemon** (tRPC/WebSocket), **web/React client** (Electron renderer and browser), thin **Electron shell**, **Expo mobile** app, and an **MCP agent plugin**. 23 Zustand stores.

## Shell & navigation
| Feature | What it does | Size |
|---|---|---|
| Three-column shell | Hub left, Viewer centre, Surfaces right | M |
| Left sidebar | Header, add project, search trigger, update chips, Hub tree; Mod+B | S |
| Right Surfaces sidebar | Tabs Files/Changes/Git/History/Canvas, reorder, context menu; Mod+., Mod+1–5 | M |
| Resizable sidebars | Persisted, clamped widths | S |
| Viewer tabs | file/diff/commit/changeset/search/canvas tabs bound to a worktree; up to 50 persist | M |
| Preview vs kept tabs | Single click previews, double-click keeps | S |
| Tab pinning | Pinned tabs sticky on the left | S |
| Tab context menu / cycling | Close others/left/right/all, open to side; Ctrl+Tab, Mod+W | S |
| Split panes | Second pane with own tab bar; Mod+Shift+S | M |
| Viewer header | Breadcrumb, Actions (Mod+Shift+A), terminal (Mod+J), surfaces toggle | M |
| Responsive auto-collapse | Sidebars collapse as the window narrows; sheets on phone | S |
| Zen mode | Store exists, nothing triggers it (dead) | S |
| Window chrome | macOS traffic lights; frameless controls on Linux/Windows | M |
| Multi-window, app menu, tray, document title | Native shell niceties | S–M |
| Unread dots | Dot on Changes when agent edits land elsewhere | S |
| Error boundary, browser token gate, safe-area/iPad | Robustness and browser access | S |

## Projects & worktrees
| Feature | What it does | Size |
|---|---|---|
| Hub tree | Environments → Projects → Worktrees, collapsible | L |
| Open project | Daemon folder browser | M |
| Recent / remove project | Without deleting the checkout | S |
| Create worktree | New or existing branch, base ref; setup scripts run | M |
| Remove worktree | Confirm, dispose scripts, protects primary checkout | M |
| Switch branch from row | Searchable checkout dialog | S |
| Worktree lifecycle scripts | Per-project setup/dispose commands, trust-gated | M |
| Row copy actions | Copy paths/names | S |
| Selection persistence | Remembers selection | S |
| Environments (remote daemons) | Multi-endpoint remote machines, encrypted tokens | L |
| Local daemon lifecycle | Child process with backoff restart | M |
| "This device" terminals on remote projects | Map remote repo to a local folder | M |
| Monorepo scope / worktree profile | Pinned, hidden paths, review layers | M |

## Review / changes
| Feature | What it does | Size |
|---|---|---|
| Changes list | Grouped by layer; status, staged, reviewed; context menu | M |
| Working vs branch scope | Uncommitted, or branch vs base | S |
| Comparison base picker | "vs <ref>", remembered per repo | S |
| Review layers (story order) | Regex layers in declared order; agents declare them | L |
| Single-file diff | Unified/split, expandable context, word diff, images | L |
| Stacked "All changes" reader | Every file as a collapsible card | L |
| Virtualised hunk renderer | Shiki, soft-wrap, gutter glyphs | L |
| Diff mode toggle | Persisted | S |
| Reviewed marks | Per file, tied to a content fingerprint; `.porcelain/reviewed.json` | M |
| Mark all reviewed | Whole change set | S |
| Review readiness badge | Freshness, ordered vs changed, evidence checks | M |
| Stage / unstage / discard | Per file and all | S |

## Comments & agent handoff
| Feature | What it does | Size |
|---|---|---|
| Comment composer | Dialog for a line range, whole file or diff | S |
| Line selection → comment | DOM selection mapped to line numbers | M |
| Gutter markers | Popover with reply, resolve/reopen, delete | M |
| Housekeeping | Resolve all, clear resolved, delete all | S |
| Storage / anchors | `comments.json`; file range, canvas section, changeset; replies, resolved | M |
| Agent MCP server | project, canvas, comment, review, profile, action (define only) | L |
| Agent plugin + skills | Codex/Claude `companion` and `remote` skills | M |
| Plugin install UI | In Settings | S |

No "send to agent" or prompt builder: agents read comments, marks and canvases through MCP.

## Files
| Feature | What it does | Size |
|---|---|---|
| File tree | Lazy, icons, live watch refresh, hidden toggle | L |
| Tree context menu | New, rename, duplicate, trash, cut/paste, copy path, reveal, pin, hide, open to side | M |
| Multi-select, keyboard nav, drag and drop | Tree interactions | S |
| Rebindable file shortcuts | With conflict detection | M |
| Pinned group, hidden paths | Per profile | S |
| Reveal active file | Expand, scroll, highlight | S |
| File viewer | Highlighted, virtualised, images/binary, agent-changed tint | M |
| Inline editing | Textarea, 800 ms autosave, adopts external rewrites | M |
| Find in file | Mod+F | S |
| Markdown reader/source | With default in preferences | S |
| HTML preview | Sandboxed iframe via daemon token | M |
| Source context menu | Copy, find references, comment, copy path | S |

## Git operations
| Feature | What it does | Size |
|---|---|---|
| Quick commands | status, pull, push, fetch, stash, stash pop with result card | M |
| Suggested next step | Pull/push/stash suggestion from status | S |
| Publish branch | Confirm first push, set tracking | S |
| Commit composer | Conventional type/scope from repo conventions, persisted draft | M |
| AI commit message | Spawns claude/codex/grok/opencode | M |
| AI commit groups | Propose and apply grouped commits | M |
| Branch checkout / create | Searchable local/remote | M |
| History list, file timeline | Branch log; history of the open file | S |
| Commit view | Message, files in layer order, diffs | M |
| Commit context menu | Copy SHA / message | S |

No blame, no clone.

## Canvas / artifacts
| Feature | What it does | Size |
|---|---|---|
| Canvas list surface | Private store merged with tracked `.porcelain/` overlay | M |
| HTML/Markdown canvas | Agent bundle in sandboxed iframe | M |
| Decision canvas | Summary/compare, options with risks | M |
| Review canvas | Intent/process/execution/evidence sections, evidence checks, discussion; drives Changes order | L |
| Promote to Git | Copy private canvas into `.porcelain/` | S |
| Data dispositions | Which `.porcelain/` channels git tracks (no web UI) | M |

## Terminal & processes
| Feature | What it does | Size |
|---|---|---|
| Bottom terminal panel | Daemon-owned PTY sessions survive reloads | L |
| Ghostty WASM renderer | libghostty-vt in WASM | L |
| Streaming / recovery | Scrollback replay, reconnect | L |
| Context menu, file attach, OSC 52, touch aids | Terminal niceties | S–M |
| Saved Actions | Popover of commands, run in a terminal | L |
| Action trust gate, run target picker | Safety and targeting | S |
| Dev servers | Daemon-only, no UI | M |

## Search & shortcuts
| Feature | What it does | Size |
|---|---|---|
| Quick Open (Mod+P / Mod+K) | Files, projects/worktrees, actions, SHAs | M |
| Content search (Mod+Shift+F) | `git grep` into a search tab | M |
| Rich code search | Regex/case/globs, mobile only | S |

Shortcuts: Mod+B, Mod+., Mod+1–5, Mod+J, Mod+Shift+A, Mod+T, Mod+W, Ctrl+Tab, Mod+Shift+S, Mod+Alt+N, Mod+,, Mod+P/K, Mod+Shift+F, Mod+F, Mod+S, Mod+Enter, file bindings, F2.

## Notifications & background
| Feature | What it does | Size |
|---|---|---|
| Live session change push | Daemon invalidation frames per domain | L |
| File watchers, review file watch | Live refresh | S–M |
| Notification adapters | Per domain | M |
| Reconnect / recovery | Refetch after gaps or restarts | M |
| Toasts | Errors and successes | S |
| Background sharing on close | Keep process alive when shared | S |
| Persistence | localStorage stores | S |

No OS notifications.

## Settings
| Feature | What it does | Size |
|---|---|---|
| Settings dialog (Mod+,) | Scoped sections | S |
| General | Appearance, diff layout, markdown/HTML default, pull strategy, commit model | M |
| Keyboard shortcuts | Rebind file commands | S |
| Companion | Plugin install | S |
| Environments | Remote groups, endpoints, pairing | L |
| Share | LAN/Tailscale/Cloudflare, pair device QR, access list | L |
| Updates | Desktop and daemon updates | M |

## Updates, onboarding, misc
Desktop auto-update (S), remote daemon update chip (S), protocol gate (S), dev profiles/devtools (M), host CLI (M), marketing site (S). Onboarding is only Home + Open project.

## Mobile (`apps/mobile`)
Phone/tablet shells, hub/worktrees, files/preview, changes/diff/comments (gutter stubbed), git/history/canvas, search, terminals board, native Ghostty module, QR pairing, settings. Mostly L.

## Pierre coverage
- **@pierre/trees:** tree rendering, expansion, reveal, keyboard nav, multi-select, rename, drag and drop, search, icons, git status.
- **@pierre/diffs:** unified/split diff, highlighting, virtualisation, word diff, context expand, file view, stacked multi-file reader (CodeView), line selection, inline annotations and gutter comment button, change tinting, merge conflicts, SSR/workers.
- **Still custom:** file-operation backends and context menus, pin/hide, watch refresh; layers, reviewed marks, readiness, base picker; comment storage, threads, MCP; editing/autosave/find; markdown/HTML/image viewers; canvas; git flows; terminal; actions; search dialogs; environments/share; session push; shell/tabs/splits; settings; updater; window chrome.

## Dead or half-built on main
Zen mode (never triggered); unmounted ProjectSwitcher, WorktreeSwitcher, BranchSwitcher chip, Hub summaries; unused `notesHeight`; dev servers without UI; `searchCode` mobile-only; data dispositions without web UI; many unused TestIds (welcome, glance, review list/canvas tabs, evidence panels, setup prompts); "clone" documented but absent; mobile comment gutter stubbed and duplicate New Worktree UIs.
