# Product scope

Porcelain helps a developer understand and review code produced by agents running in other tools.
Scope is intentional; there is no requirement to preserve the previous application's features.

## Supported surfaces

Electron on macOS, a browser interface, and Expo on iPhone and iPad are intended products.
Android should remain compatible, with a smaller smoke-validation commitment and no assumption
that Expo compatibility alone proves its behavior. The standalone Node server runs on macOS and Linux.
Electron starts or connects to the local server. Linux can run it independently as a managed service.
Clients connect through LAN, Tailscale, or HTTPS through a configured Cloudflare domain.

## Review workspace

A persistent worktree navigator combines projects and worktrees from local and remote environments.
Selecting a worktree establishes context for Files, Changes, History, comments, and artifacts.
Each environment remains authoritative for its own repositories and private data.

Files supports reading project files, pinning files/folders, hiding distracting paths, and useful
file conveniences. The exact file-management operations and preference scope remain to be decided.

Changes presents diffs in agent-authored review layers with explicit group and file order.
Unassigned changes remain visible. Review order must remain available in History when changes are
committed, including commits created outside Porcelain. Split commits and concurrent edits require
explicit association rules; a post-commit HTML update must not be required for this behavior.

Git controls include fetch, push, stash, and commit; staging and other operations are introduced only
as needed for the agreed workflow. History includes commit diffs and file timelines.

Artifacts are agent-uploaded HTML rendered in isolation, stored outside the repository, and shareable.
Sharing audience, lifetime, assets, and hosting behavior remain open decisions. Artifacts are independent
of review layers. Comments attach to files, code ranges, or diffs. Agents read and respond through MCP
and apply fixes in their own tools. Discussion depth and anchor behavior require explicit design.

## Boundaries

Porcelain does not host agents or act as an IDE. Generic terminals, shell Actions, AI commit generation,
structured Canvas templates, and promotion of artifacts into Git are not part of the agreed rebuild.
No additional product scope or infrastructure should be inferred from the old implementation.
