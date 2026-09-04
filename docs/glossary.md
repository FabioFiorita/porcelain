# Domain language

These terms describe the human-facing model. Their fields and operations belong in the
[contracts](../packages/contracts/src/), not in this glossary.

| Term | Meaning in Porcelain |
| --- | --- |
| Environment | A daemon's authority over code and processes on its host. Another route to that daemon is not another owner. A WSL distribution is separate from its Windows host. |
| Project | A repository registered with an Environment, bringing its checkouts and review context together. |
| Worktree | A particular checkout of a Project. Work and review must target the intended checkout, even when several share Git history. |
| Changes | The place to inspect the actual diff, stage work, and track reviewed state. An explanation does not replace this evidence. |
| Canvas | Shared explanatory material around the work. A Decision Canvas supports an unresolved choice; a Review Canvas explains a coherent change. |
| Reviewed | A human review judgment tied to content. It is not a synonym for an agent having read the file or for tests passing. |
| History | Committed work and its associated review context. A live review of uncommitted work is not yet a review attached to a commit. |
| Navigation profile | The human's pins and hidden paths for finding their way around a Project. It is not an agent task plan. |
| Action | A saved command offered for the human to run. Defining it does not authorize its execution. |
| Pairing | Granting a device revocable access to one daemon. It does not share the host's administrator credential. |
| Promotion | Making selected private Porcelain data repository-visible. It does not itself stage or commit that data. |
| Playground | Disposable repository data used to exercise development behavior without touching real projects. |
