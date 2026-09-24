import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import type { CheckGitActionScopeInput } from '../models/check-git-action-scope.ts';
import { worktreeInProject } from '../rules/worktree-in-project.ts';

export class CheckGitActionScopeService {
  execute(input: CheckGitActionScopeInput): void {
    if (!worktreeInProject(input.worktree, input.projectId))
      throw new WorktreeNotFoundError();
  }
}
