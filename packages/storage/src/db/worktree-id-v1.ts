import { createHash } from 'node:crypto';

export function worktreeIdV1(
  projectId: string,
  metadataIdentity: string,
  length: number,
): string {
  return createHash('sha256')
    .update(`porcelain-worktree-id-v1\0${projectId}\0${metadataIdentity}`)
    .digest('hex')
    .slice(0, length);
}
