# Environment-owned inventory

An environment is one independently managed server data directory with a persistent random ID. Addresses are ways to reach it, not its identity. A project is one Git common directory; linked worktrees share that project, while another clone remains a separate project.

Registration is explicit. Git owns the current worktree list, which Porcelain reads when inventory is requested. A worktree ID is derived from the project ID and filesystem identity of its administrative Git directory. This preserves ordinary moves and rejects a different checkout placed at an old path, but cannot prove continuity through arbitrary filesystem restoration, inode reuse, or network filesystem behavior.

Project metadata is stored independently of repository availability, so health and pairing never wait on Git. Inventory listings inspect projects concurrently under a global launch limit and a per-project timeout. An unavailable project retains its last-known worktrees; only a successful Git listing can mark a worktree absent. Review data for a worktree Git no longer reports is retained for thirty days, then collected. An unreachable drive never starts that clock.

Project names are derived from the origin repository name at registration unless the owner has named the project. Owner-supplied names are never overwritten by later discovery. Duplicate names are valid because IDs, not labels, establish identity.
