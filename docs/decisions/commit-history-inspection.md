# Commit history and inspection

History lists all ancestors of the selected worktree HEAD in topological order. The first page captures the tip; a continuation carries that tip and the frontier whose children were already shown, preserving every parent of a merge without replaying earlier pages. If the supplied history no longer belongs to the current graph, the server restarts from the top and reports that fact. A shallow or unusually wide graph ends with an explicit boundary instead of an incomplete success.

Inspection compares a commit with its first parent unless another one-based parent is selected; roots compare with the empty tree. It accepts full commit IDs still present in the repository even when they are no longer reachable from the current HEAD. No refs or objects are retained for pagination, so garbage collection can make an older target unavailable.

History reads do not fetch, run external diff tools, use text-conversion filters, or invoke filesystem-monitor programs. Output and response sizes are bounded; invalid UTF-8 and oversized results fail explicitly. Binary files and submodules are identified without recursively returning their contents. The checkout identity is confirmed around reads, but externally mutable Git objects and files are observations rather than an atomic snapshot.
