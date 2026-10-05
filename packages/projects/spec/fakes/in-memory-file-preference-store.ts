import { Effect } from 'effect';
import type {
  FilePreference,
  FilePreferenceKey,
  ProjectFilePreference,
} from '../../src/models/file-preference.ts';
import type { ProjectKey } from '../../src/models/project.ts';
import type { FilePreferenceStore } from '../../src/ports/file-preference-store.ts';

type Row = ProjectFilePreference;

export class InMemoryFilePreferenceStore implements FilePreferenceStore {
  private readonly rows: Map<string, Row>;

  constructor(rows: readonly Row[] = []) {
    this.rows = new Map(
      rows.map((row) => [
        key({ projectId: row.projectId, path: row.preference.path }),
        { projectId: row.projectId, preference: { ...row.preference } },
      ]),
    );
  }

  list(input: ProjectKey): Effect.Effect<FilePreference[]> {
    return Effect.sync(() => {
      return this.project(input)
        .map((row) => ({ ...row.preference }))
        .sort(
          (left, right) =>
            Number(left.path > right.path) - Number(left.path < right.path),
        );
    });
  }

  find(input: FilePreferenceKey): Effect.Effect<FilePreference | undefined> {
    return Effect.sync(() => {
      const row = this.rows.get(key(input));
      return row && { ...row.preference };
    });
  }

  count(input: ProjectKey): Effect.Effect<number> {
    return Effect.sync(() => {
      return this.project(input).length;
    });
  }

  save(input: ProjectFilePreference): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows.set(
        key({ projectId: input.projectId, path: input.preference.path }),
        {
          projectId: input.projectId,
          preference: { ...input.preference },
        },
      );
    });
  }

  remove(input: FilePreferenceKey): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows.delete(key(input));
    });
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
