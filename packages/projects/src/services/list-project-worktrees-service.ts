import type {
  ListProjectWorktreesInput,
  ListProjectWorktreesResult,
} from '../models/list-project-worktrees.ts';
import type { ProjectWorktreeReader } from '../ports/project-worktree-reader.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListProjectWorktreesService {
  private readonly projectWorktreeReader: ProjectWorktreeReader;

  constructor(projectWorktreeReader: ProjectWorktreeReader) {
    this.projectWorktreeReader = projectWorktreeReader;
  }

  async execute(
    input: ListProjectWorktreesInput,
    signal?: AbortSignal,
  ): Promise<ListProjectWorktreesResult> {
    const listing = await this.projectWorktreeReader.list(
      input.project,
      signal,
    );
    if (listing.kind === 'listed')
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
      worktrees: unavailableWorktrees(
        this.projectWorktreeReader.lastSeen({ projectId: listing.projectId }),
      ),
    };
  }
}
