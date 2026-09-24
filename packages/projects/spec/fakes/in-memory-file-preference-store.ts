import type {
  FilePreference,
  FilePreferenceKey,
  ProjectFilePreference,
} from '../../src/models/file-preference.ts';
import type { ProjectKey } from '../../src/models/project.ts';
import type { FilePreferenceStore } from '../../src/ports/file-preference-store.ts';

type Row = ProjectFilePreference;

export class InMemoryFilePreferenceStore implements FilePreferenceStore {
  private rows = new Map<string, Row>();

  list(input: ProjectKey): FilePreference[] {
    return this.project(input)
      .map((row) => ({ ...row.preference }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  find(input: FilePreferenceKey): FilePreference | undefined {
    const row = this.rows.get(key(input));
    return row && { ...row.preference };
  }

  count(input: ProjectKey): number {
    return this.project(input).length;
  }

  save(input: ProjectFilePreference): void {
    this.rows.set(
      key({ projectId: input.projectId, path: input.preference.path }),
      {
        projectId: input.projectId,
        preference: { ...input.preference },
      },
    );
  }

  remove(input: FilePreferenceKey): void {
    this.rows.delete(key(input));
  }

  private project(input: ProjectKey): Row[] {
    return [...this.rows.values()].filter(
      (row) => row.projectId === input.projectId,
    );
  }
}

function key(input: FilePreferenceKey): string {
  return `${input.projectId}\0${input.path}`;
}
