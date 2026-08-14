# One window for the multi-environment hub

Porcelain will replace its one-repository-per-window model with one persistent client shell that can connect to and navigate across multiple local and remote Environments. Projects and Worktrees remain environment-local operational targets, while the client aggregates them in one Hub; active files, diffs, Tasks, terminals, and agent-authored Canvases remain tabbed and splittable inside that shell. This removes the context-switching cost that motivated the redesign without requiring a central service to own project data.
