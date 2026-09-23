import type {
  ProjectParams,
  RenameProjectRequest,
  RenameProjectResponse,
} from '@porcelain/contracts/projects';
import type { RenameProjectService } from '@porcelain/projects/services';

type RunInventoryWrite = <T>(
  operation: () => T | Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class RenameProjectController {
  private readonly renameProject: RenameProjectService;
  private readonly runInventoryWrite: RunInventoryWrite;
  private readonly publishInventoryChanged: () => void;

  constructor(
    renameProject: RenameProjectService,
    runInventoryWrite: RunInventoryWrite,
    publishInventoryChanged: () => void,
  ) {
    this.renameProject = renameProject;
    this.runInventoryWrite = runInventoryWrite;
    this.publishInventoryChanged = publishInventoryChanged;
  }

  async execute(
    input: ProjectParams & RenameProjectRequest,
    context: { signal?: AbortSignal },
  ): Promise<RenameProjectResponse> {
    const result = await this.runInventoryWrite(
      () => this.renameProject.execute(input.projectId, input.name),
      context.signal,
    );
    this.publishInventoryChanged();
    return result;
  }
}
