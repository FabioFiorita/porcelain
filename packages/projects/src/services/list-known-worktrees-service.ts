import type {
  ListKnownWorktreesInput,
  ListKnownWorktreesResult,
} from '../models/list-known-worktrees.ts';
import type { ProjectWorktreeReader } from '../ports/project-worktree-reader.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListKnownWorktreesService {
  private readonly projectWorktreeReader: ProjectWorktreeReader;

  constructor(projectWorktreeReader: ProjectWorktreeReader) {
    this.projectWorktreeReader = projectWorktreeReader;
  }

  execute(input: ListKnownWorktreesInput): ListKnownWorktreesResult {
    return {
      listings: input.projects.map((project) => {
        const worktrees = this.projectWorktreeReader.lastSeen({
          projectId: project.id,
        });
        return {
          projectId: project.id,
          available: project.available,
          worktrees: project.available
            ? worktrees
            : unavailableWorktrees(worktrees),
        };
      }),
    };
  }
}
