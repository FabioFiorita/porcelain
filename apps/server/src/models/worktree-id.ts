import { createHash } from 'node:crypto';

/**
 * Names this derivation so a later change to it is explicit rather than a
 * silent reshuffle of everyone's review data.
 */
const domain = 'porcelain-worktree-id-v1';

/**
 * A worktree's identity, derived rather than stored.
 *
 * The inputs are the project and the filesystem identity of the worktree's
 * administrative Git directory, so the same worktree keeps its id across a
 * restart and across `git worktree move` — the administrative directory does
 * not move when the checkout does.
 *
 * This is **best effort**, not a guarantee. It relies on the filesystem
 * reporting a stable device, inode and birth time: on a local filesystem a
 * recreated worktree gets a new id, but an inode can be reused and a network
 * filesystem can synthesise or change the tuple across a remount. The decision
 * record says where that surfaces; do not describe it as a promise.
 */
export function deriveWorktreeId(
  projectId: string,
  metadataIdentity: string,
): string {
  return createHash('sha256')
    .update(`${domain}\0${projectId}\0${metadataIdentity}`)
    .digest('hex')
    .slice(0, 32);
}
