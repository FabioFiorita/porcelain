import type { ProjectKey } from '../../src/models/project.ts';
import type {
  RemoveWorktreePresenceInput,
  SaveWorktreePresenceInput,
  WorktreePresence,
} from '../../src/models/worktree-presence.ts';
import type { WorktreePresenceStore } from '../../src/ports/worktree-presence-store.ts';

export class InMemoryWorktreePresenceStore implements WorktreePresenceStore {
  private rows = new Map<string, WorktreePresence>();

  list(): WorktreePresence[] {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }

  read(input: ProjectKey): WorktreePresence[] {
    return this.list().filter((row) => row.projectId === input.projectId);
  }

  save(input: SaveWorktreePresenceInput): void {
    this.rows = new Map([
      ...this.rows,
      ...input.rows.map((row): [string, WorktreePresence] => [
        row.worktreeId,
        { ...row },
      ]),
    ]);
  }

  remove(input: RemoveWorktreePresenceInput): void {
    this.rows = new Map(
      [...this.rows].filter(
        ([worktreeId]) => !input.worktreeIds.includes(worktreeId),
      ),
    );
  }
}
