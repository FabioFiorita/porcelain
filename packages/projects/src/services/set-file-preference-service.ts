import { FilePreferenceLimitError } from '../errors/file-preference-limit-error.ts';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { FilePreference } from '../models/file-preference.ts';
import type {
  SetFilePreferenceInput,
  SetFilePreferenceOptions,
  SetFilePreferenceResult,
} from '../models/set-file-preference.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class SetFilePreferenceService {
  private readonly inventory: InventoryStore;
  private readonly filePreference: FilePreferenceStore;
  private readonly options: SetFilePreferenceOptions;

  constructor(
    inventory: InventoryStore,
    filePreference: FilePreferenceStore,
    options: SetFilePreferenceOptions,
  ) {
    this.inventory = inventory;
    this.filePreference = filePreference;
    this.options = options;
  }

  execute(input: SetFilePreferenceInput): SetFilePreferenceResult {
    const { projectId, path } = input;
    const project = this.inventory.find({ projectId });
    if (!project) throw new ProjectNotFoundError();
    const existing = this.filePreference.find({ projectId, path });
    const next: FilePreference = {
      path,
      pinned: existing?.pinned ?? false,
      hidden: existing?.hidden ?? false,
      [input.flag]: input.value,
    };
    if (!next.pinned && !next.hidden) {
      if (existing) this.filePreference.remove({ projectId, path });
    } else {
      if (
        !existing &&
        this.filePreference.count({ projectId }) >= this.options.maxPreferences
      )
        throw new FilePreferenceLimitError();
      this.filePreference.save({ projectId, preference: next });
    }
    return { preferences: this.filePreference.list({ projectId }) };
  }
}
