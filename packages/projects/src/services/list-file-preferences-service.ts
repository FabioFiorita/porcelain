import { Effect } from 'effect';
import type {
  ListFilePreferencesInput,
  ListFilePreferencesResult,
} from '../models/list-file-preferences.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';

export class ListFilePreferencesService {
  private readonly filePreference: FilePreferenceStore;

  constructor(filePreference: FilePreferenceStore) {
    this.filePreference = filePreference;
  }

  execute(
    input: ListFilePreferencesInput,
  ): Effect.Effect<ListFilePreferencesResult, never> {
    return Effect.sync(() => {
      return {
        preferences: this.filePreference.list({ projectId: input.projectId }),
      };
    });
  }
}
