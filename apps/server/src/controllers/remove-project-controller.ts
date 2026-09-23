import type {
  RemoveProjectInput,
  RemoveProjectOutput,
} from '@porcelain/contracts/projects';
import type { RemoveProjectService } from '@porcelain/projects/services';

type RunProjectWrite = <T>(
  projectId: string,
  operation: () => T | Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class RemoveProjectController {
  private readonly removeProject: RemoveProjectService;
  private readonly runProjectWrite: RunProjectWrite;
  private readonly forgetProject: (projectId: string) => void;
  private readonly publishInventoryChanged: () => void;

  constructor(
    removeProject: RemoveProjectService,
    runProjectWrite: RunProjectWrite,
    forgetProject: (projectId: string) => void,
    publishInventoryChanged: () => void,
  ) {
    this.removeProject = removeProject;
    this.runProjectWrite = runProjectWrite;
    this.forgetProject = forgetProject;
    this.publishInventoryChanged = publishInventoryChanged;
  }

  async execute(
    input: RemoveProjectInput,
    context: { signal?: AbortSignal },
  ): Promise<RemoveProjectOutput> {
    const result = await this.runProjectWrite(
      input.projectId,
      () => {
        const answer = this.removeProject.execute(input.projectId);
        if (answer.deleted) this.forgetProject(input.projectId);
        return answer;
      },
      context.signal,
    );
    if (result.deleted) this.publishInventoryChanged();
    return result;
  }
}
