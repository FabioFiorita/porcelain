import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import { type RecordWorktreePresenceInput } from '../models/record-worktree-presence.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { observed, sighted } from '../rules/worktree-presence.ts';

export class RecordWorktreePresenceService extends Context.Service<
  RecordWorktreePresenceService,
  {
    readonly execute: (
      input: RecordWorktreePresenceInput,
    ) => Effect.Effect<void, ProjectNotFoundError>;
  }
>()('@porcelain/projects/RecordWorktreePresenceService') {
  static readonly layer = Layer.effect(
    RecordWorktreePresenceService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;
      const worktreePresenceCapability = yield* WorktreePresenceStore;
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('RecordWorktreePresenceService.execute')(function* (
          input: RecordWorktreePresenceInput,
        ): Effect.fn.Return<void, ProjectNotFoundError> {
          const { projectId, available, complete, worktrees } = input.worktrees;
          const project = yield* inventoryCapability.find({ projectId });
          if (!project) return yield* Effect.fail(new ProjectNotFoundError());
          if (!available) return;
          const rows = yield* worktreePresenceCapability.read({ projectId });
          const presentIds = worktrees.map((worktree) => worktree.id);
          yield* worktreePresenceCapability.save({
            rows: complete
              ? observed(rows, projectId, presentIds, clockCapability.now())
              : sighted(rows, projectId, presentIds),
          });
        }),
      };
    }),
  );
}
