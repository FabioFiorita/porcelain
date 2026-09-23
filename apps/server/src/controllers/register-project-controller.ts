import type { ProjectResponse } from '@porcelain/contracts/projects';

type RegisteredWorktree = Omit<ProjectResponse['worktrees'][number], 'status'>;
type RegistrationProject = Omit<ProjectResponse, 'worktrees'> & {
  worktrees: RegisteredWorktree[];
};
type RegisterProject = {
  execute(
    path: string,
    signal?: AbortSignal,
  ): Promise<{ project: RegistrationProject }>;
};
type WorktreeStatuses = (
  worktreeIds: string[],
) => ReadonlyMap<string, ProjectResponse['worktrees'][number]['status']>;
type RunInventoryWrite = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class RegisterProjectController {
  private readonly registerProject: RegisterProject;
  private readonly worktreeStatuses: WorktreeStatuses;
  private readonly runInventoryWrite: RunInventoryWrite;
  private readonly publishInventoryChanged: () => void;

  constructor(
    registerProject: RegisterProject,
    worktreeStatuses: WorktreeStatuses,
    runInventoryWrite: RunInventoryWrite,
    publishInventoryChanged: () => void,
  ) {
    this.registerProject = registerProject;
    this.worktreeStatuses = worktreeStatuses;
    this.runInventoryWrite = runInventoryWrite;
    this.publishInventoryChanged = publishInventoryChanged;
  }

  async execute(
    input: { path: string },
    context: { signal?: AbortSignal },
  ): Promise<ProjectResponse> {
    const project = await this.runInventoryWrite(async (signal) => {
      const registered = await this.registerProject.execute(input.path, signal);
      const statuses = this.worktreeStatuses(
        registered.project.worktrees.map((worktree) => worktree.id),
      );
      return {
        ...registered.project,
        worktrees: registered.project.worktrees.map((worktree) => ({
          ...worktree,
          status: statuses.get(worktree.id) ?? null,
        })),
      };
    }, context.signal);
    this.publishInventoryChanged();
    return project;
  }
}
