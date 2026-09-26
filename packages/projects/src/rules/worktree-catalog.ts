import type { ListProjectWorktreesResult } from '../models/list-project-worktrees.ts';
import type { ListableProject } from '../models/project.ts';
import type { CatalogSnapshot } from '../models/worktree-catalog.ts';

export function catalogSnapshot(
  projects: readonly ListableProject[],
  listings: readonly ListProjectWorktreesResult[],
  observedAt: string,
): CatalogSnapshot {
  const byProject = new Map(
    listings.map((listing) => [listing.projectId, listing]),
  );
  return {
    projects: projects.flatMap((project) => {
      const listing = byProject.get(project.id);
      return listing
        ? [
            {
              observation: {
                id: project.id,
                commonDirectory: project.commonDirectory,
                repositoryIdentity: project.repositoryIdentity,
                observedAt,
                listed: listing.available,
              },
              worktrees: listing.worktrees,
            },
          ]
        : [];
    }),
  };
}
