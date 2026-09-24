import { FilePreferenceLimitError } from '../errors/file-preference-limit-error.ts';
import type { FilePreference } from '../models/file-preference.ts';
import type {
  SetFilePreferenceInput,
  SetFilePreferenceOptions,
  SetFilePreferenceResult,
} from '../models/set-file-preference.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';

export class SetFilePreferenceService {
  private readonly filePreference: FilePreferenceStore;
  private readonly options: SetFilePreferenceOptions;

  constructor(
    filePreference: FilePreferenceStore,
    options: SetFilePreferenceOptions,
  ) {
    this.filePreference = filePreference;
    this.options = options;
  }

  execute(input: SetFilePreferenceInput): SetFilePreferenceResult {
    const { projectId, path } = input;
    const existing = this.filePreference.find({ projectId, path });
    const next: FilePreference = {
      path,
      pinned: existing?.pinned ?? false,
      hidden: existing?.hidden ?? false,
      [input.flag]: input.value,
    };
    const changed =
      (existing?.pinned ?? false) !== next.pinned ||
      (existing?.hidden ?? false) !== next.hidden;
    if (!changed)
      return { preferences: this.filePreference.list({ projectId }), changed };
    if (!next.pinned && !next.hidden) {
      this.filePreference.remove({ projectId, path });
    } else {
      if (
        !existing &&
        this.filePreference.count({ projectId }) >= this.options.maxPreferences
      )
        throw new FilePreferenceLimitError();
      this.filePreference.save({ projectId, preference: next });
    }
    return { preferences: this.filePreference.list({ projectId }), changed };
  }
}
