import { Effect, Context, Layer } from 'effect';
import { type ForgetProjectRecordsInput } from '../models/find-project.ts';
import { FilePreferenceStore } from '../ports/file-preference-store.ts';
import { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';

export class ForgetProjectRecordsService extends Context.Service<
  ForgetProjectRecordsService,
  {
    readonly execute: (
      input: ForgetProjectRecordsInput,
    ) => Effect.Effect<void, never>;
  }
>()('@porcelain/projects/ForgetProjectRecordsService') {
  static readonly layer = Layer.effect(
    ForgetProjectRecordsService,
    Effect.gen(function* () {
      const worktreePresenceCapability = yield* WorktreePresenceStore;
      const filePreferenceCapability = yield* FilePreferenceStore;

      return {
        execute: Effect.fn('ForgetProjectRecordsService.execute')(function* (
          input: ForgetProjectRecordsInput,
        ): Effect.fn.Return<void, never> {
          const { projectId } = input;
          yield* worktreePresenceCapability.remove({
            worktreeIds: (yield* worktreePresenceCapability.read({
              projectId,
            })).map((row) => row.worktreeId),
          });
          for (const preference of yield* filePreferenceCapability.list({
            projectId,
          }))
            yield* filePreferenceCapability.remove({
              projectId,
              path: preference.path,
            });
        }),
      };
    }),
  );
}
