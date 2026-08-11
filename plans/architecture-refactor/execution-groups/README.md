# Execution groups

Tracked manifests for the architecture-executor dispatcher. Each `*.group.json`
file is one dependency-safe batch of recipes that share a managed worktree and
run sequentially in fresh Grok or Claude Personal processes.

Copy `template.group.json`, replace the example fields, and validate:

```bash
node scripts/architecture/dispatch.mjs validate plans/architecture-refactor/execution-groups/<name>.group.json
```

Runtime state, logs, prompts, and packets are **not** tracked — they live under
gitignored `scripts/agent-scratch/orchestration/<group-id>/`.

Full operator model: [`docs/internals/architecture-dispatch.md`](../../../docs/internals/architecture-dispatch.md).
