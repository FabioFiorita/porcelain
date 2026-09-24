import type { ForgetProjectWorktreesInput } from '../models/forget-project-worktrees.ts';
import type { ProjectWorktreeReader } from '../ports/project-worktree-reader.ts';

export class ForgetProjectWorktreesService {
  private readonly projectWorktreeReader: ProjectWorktreeReader;

  constructor(projectWorktreeReader: ProjectWorktreeReader) {
    this.projectWorktreeReader = projectWorktreeReader;
  }

  execute(input: ForgetProjectWorktreesInput): void {
    this.projectWorktreeReader.forget({ projectId: input.projectId });
  }
}
