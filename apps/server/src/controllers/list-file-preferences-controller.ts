import type { FilePreference } from '@porcelain/projects/models';
import type { ListFilePreferencesService } from '@porcelain/projects/services';

type RunStored = <T>(operation: () => T | Promise<T>) => Promise<T>;

export class ListFilePreferencesController {
  private readonly listFilePreferences: ListFilePreferencesService;
  private readonly runStored: RunStored;

  constructor(
    listFilePreferences: ListFilePreferencesService,
    runStored: RunStored,
  ) {
    this.listFilePreferences = listFilePreferences;
    this.runStored = runStored;
  }

  execute(input: {
    projectId: string;
  }): Promise<{ preferences: FilePreference[] }> {
    return this.runStored(() => ({
      preferences: this.listFilePreferences.execute(input.projectId),
    }));
  }
}
