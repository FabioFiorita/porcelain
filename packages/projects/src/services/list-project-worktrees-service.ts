import type { ListProjectWorktreesInput } from '../models/inventory-operations.ts';
import type { ProjectWorktrees } from '../models/worktree-listing.ts';
import type { ProjectWorktreeReader } from '../ports/project-worktree-reader.ts';

export class ListProjectWorktreesService {
  private readonly projectWorktreeReader: ProjectWorktreeReader;

  constructor(projectWorktreeReader: ProjectWorktreeReader) {
    this.projectWorktreeReader = projectWorktreeReader;
  }

  async execute(
    input: ListProjectWorktreesInput,
    signal?: AbortSignal,
  ): Promise<ProjectWorktrees> {
    const listing = await this.projectWorktreeReader.list(
      input.project,
      signal,
    );
    if (listing.outcome === 'listed')
      return {
        projectId: listing.projectId,
        available: true,
        complete: listing.unidentified === 0,
        worktrees: listing.worktrees,
      };
    return {
      projectId: listing.projectId,
      available: false,
      complete: false,
      worktrees: listing.lastSeen.map((worktree) => ({
        ...worktree,
        available: false,
      })),
    };
  }
}
