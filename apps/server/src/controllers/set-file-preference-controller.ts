import type {
  FilePreference,
  FilePreferenceChange,
} from '@porcelain/projects/models';
import type { SetFilePreferenceService } from '@porcelain/projects/services';

type RunStored = <T>(operation: () => T | Promise<T>) => Promise<T>;

export class SetFilePreferenceController {
  private readonly setFilePreference: SetFilePreferenceService;
  private readonly runStored: RunStored;
  private readonly publishPreferencesChanged: (projectId: string) => void;

  constructor(
    setFilePreference: SetFilePreferenceService,
    runStored: RunStored,
    publishPreferencesChanged: (projectId: string) => void,
  ) {
    this.setFilePreference = setFilePreference;
    this.runStored = runStored;
    this.publishPreferencesChanged = publishPreferencesChanged;
  }

  async execute(
    input: FilePreferenceChange & { projectId: string },
  ): Promise<{ preferences: FilePreference[] }> {
    const preferences = await this.runStored(() =>
      this.setFilePreference.execute(input.projectId, {
        path: input.path,
        flag: input.flag,
        value: input.value,
      }),
    );
    this.publishPreferencesChanged(input.projectId);
    return { preferences };
  }
}
