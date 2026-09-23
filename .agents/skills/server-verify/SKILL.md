---
name: server-verify
description: Run Porcelain's isolated server and collect repeatable HTTP evidence for mapped server features. Use when verifying server behavior or a server change; current coverage is project rename and removal.
---

# Server verification

Read the relevant entry in `feature-map/` before verifying a feature. The map records intended behavior and how the feature is reached; the CLI exercises only the cases it names as implemented.

For project rename or removal, run from the repository root:

```sh
node .agents/skills/server-verify/scripts/verify.ts projects.rename
node .agents/skills/server-verify/scripts/verify.ts projects.remove
```

The command creates an isolated server and Git fixture, exercises the mapped HTTP cases, then writes an evidence JSON file outside the worktree. Read that file before reporting a result. Report the command's exit status, the assertions that ran, and any mismatch or setup failure. A successful command verifies only the cases listed in its evidence; it is not proof that every server feature works.

If a new case or feature is needed, agree on its intended behavior in the feature map before adding an executable assertion. Keep credentials out of evidence and user-facing output.
