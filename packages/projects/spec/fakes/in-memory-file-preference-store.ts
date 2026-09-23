import type { FilePreference } from '@porcelain/projects/models';
import type { FilePreferenceStore } from '@porcelain/projects/ports';

export class InMemoryFilePreferenceStore implements FilePreferenceStore {
  private readonly rows = new Map<string, Map<string, FilePreference>>();

  list(projectId: string): FilePreference[] {
    return [...(this.rows.get(projectId)?.values() ?? [])]
      .map((preference) => ({ ...preference }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  find(projectId: string, path: string): FilePreference | undefined {
    const preference = this.rows.get(projectId)?.get(path);
    return preference ? { ...preference } : undefined;
  }

  count(projectId: string): number {
    return this.rows.get(projectId)?.size ?? 0;
  }

  save(projectId: string, preference: FilePreference): void {
    const project =
      this.rows.get(projectId) ?? new Map<string, FilePreference>();
    project.set(preference.path, { ...preference });
    this.rows.set(projectId, project);
  }

  remove(projectId: string, path: string): void {
    this.rows.get(projectId)?.delete(path);
  }
}
