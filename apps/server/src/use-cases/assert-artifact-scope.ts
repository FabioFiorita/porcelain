import type { ResolveWorktree } from './resolve-worktree.ts';

/**
 * Artifacts ask the same question as everything else. A worktree whose disk is
 * out still counts: an agent's handoff should not vanish because a drive was
 * unplugged, and nothing here reads the checkout.
 */
export async function assertArtifactScope(
  worktrees: ResolveWorktree,
  worktreeId: string,
  signal?: AbortSignal,
) {
  await worktrees.known(worktreeId, signal);
}
