import { randomUUID } from 'node:crypto';
import { basename, dirname } from 'node:path';
import type { DiscoveredRepository } from '../../git/dtos/discovered-repository.ts';
import type { Project } from '../../models/project.ts';

export function reconcileProject(
  discovered: DiscoveredRepository,
  previous?: Project,
): Project {
  return {
    id: previous?.id ?? randomUUID(),
    name: previous?.name ?? basename(dirname(discovered.commonDirectory)),
    commonDirectory: discovered.commonDirectory,
    repositoryIdentity: discovered.repositoryIdentity,
    available: true,
    worktrees: discovered.worktrees.map((worktree) => {
      const known = previous?.worktrees.find((candidate) =>
        worktree.metadataIdentity
          ? candidate.metadataIdentity === worktree.metadataIdentity
          : candidate.path === worktree.path,
      );
      return {
        ...worktree,
        id: known?.id ?? randomUUID(),
        metadataIdentity:
          worktree.metadataIdentity || known?.metadataIdentity || '',
      };
    }),
  };
}
