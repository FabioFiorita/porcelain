import { Effect } from 'effect';
import type { ProjectKey } from '../../src/models/project.ts';
import type {
  RemoveWorktreePresenceInput,
  SaveWorktreePresenceInput,
  WorktreePresence,
} from '../../src/models/worktree-presence.ts';
import type { WorktreePresenceStore } from '../../src/ports/worktree-presence-store.ts';

export class InMemoryWorktreePresenceStore implements WorktreePresenceStore {
  private rows = new Map<string, WorktreePresence>();

  list(): Effect.Effect<WorktreePresence[]> {
    return Effect.sync(() => {
      return [...this.rows.values()].map((row) => ({ ...row }));
    });
  }

  read(input: ProjectKey): Effect.Effect<WorktreePresence[]> {
    return Effect.gen({ self: this }, function* () {
      return (yield* this.list()).filter(
        (row) => row.projectId === input.projectId,
      );
    });
  }

  save(input: SaveWorktreePresenceInput): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows = new Map([
        ...this.rows,
        ...input.rows.map((row): [string, WorktreePresence] => [
          row.worktreeId,
          { ...row },
        ]),
      ]);
    });
  }

  remove(input: RemoveWorktreePresenceInput): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows = new Map(
        [...this.rows].filter(
          ([worktreeId]) => !input.worktreeIds.includes(worktreeId),
        ),
      );
    });
  }
}
