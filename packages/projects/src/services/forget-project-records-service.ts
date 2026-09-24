import type { ForgetProjectRecordsInput } from '../models/find-project.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';

export class ForgetProjectRecordsService {
  private readonly worktreePresence: WorktreePresenceStore;
  private readonly filePreference: FilePreferenceStore;

  constructor(
    worktreePresence: WorktreePresenceStore,
    filePreference: FilePreferenceStore,
  ) {
    this.worktreePresence = worktreePresence;
    this.filePreference = filePreference;
  }

  execute(input: ForgetProjectRecordsInput): void {
    const { projectId } = input;
    this.worktreePresence.remove({
      worktreeIds: this.worktreePresence
        .read({ projectId })
        .map((row) => row.worktreeId),
    });
    for (const preference of this.filePreference.list({ projectId }))
      this.filePreference.remove({ projectId, path: preference.path });
  }
}
