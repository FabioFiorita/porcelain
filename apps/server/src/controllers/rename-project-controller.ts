import { renameProjectRequestSchema } from '@porcelain/contracts/inventory';
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

  async rename(projectId: string, name: string, signal?: AbortSignal) {
    const input = renameProjectRequestSchema.parse({ name });
    const result = await this.runInventoryWrite(
      () => this.renameProject.execute(projectId, input.name),
      signal,
    );
    this.publishInventoryChanged();
    return result;
  }
}
