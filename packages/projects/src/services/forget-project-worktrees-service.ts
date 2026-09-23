import type { ForgetProjectWorktreesInput } from '../models/project-operations.ts';
import type { ProjectWorktreeReader } from '../ports/project-worktree-reader.ts';

export class ForgetProjectWorktreesService {
  private readonly projectWorktreeReader: ProjectWorktreeReader;

  constructor(projectWorktreeReader: ProjectWorktreeReader) {
    this.projectWorktreeReader = projectWorktreeReader;
  }

  execute(input: ForgetProjectWorktreesInput): void {
    this.projectWorktreeReader.forget(input.projectId);
  }
}
