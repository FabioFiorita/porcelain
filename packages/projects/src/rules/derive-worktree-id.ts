import { createHash } from 'node:crypto';

const DOMAIN = 'porcelain-worktree-id-v1';

export function deriveWorktreeId(
  projectId: string,
  metadataIdentity: string,
  length: number,
): string {
  return createHash('sha256')
    .update(`${DOMAIN}\0${projectId}\0${metadataIdentity}`)
    .digest('hex')
    .slice(0, length);
}
