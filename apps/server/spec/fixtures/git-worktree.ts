import { statSync } from 'node:fs';
import { join } from 'node:path';

export function gitWorktree(root: string) {
  const path = join(root, 'main');
  const administrativeDirectory = join(path, '.git');
  const info = statSync(administrativeDirectory, { bigint: true });
  const identity = `${info.dev}:${info.ino}:${info.birthtimeNs}`;
  return {
    id: 'worktree-1',
    projectId: 'project-1',
    repositoryId: identity,
    path,
    branch: 'refs/heads/main',
    main: true,
    available: true,
    metadataIdentity: identity,
    administrativeDirectory,
    commonDirectory: administrativeDirectory,
    repositoryIdentity: identity,
  };
}
