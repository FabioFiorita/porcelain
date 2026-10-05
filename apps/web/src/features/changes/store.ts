import { Effect } from 'effect';
import { ChangedDiffRecovery } from '@porcelain/client/changes';

export const changedDiffRecovery = Effect.runSync(
  ChangedDiffRecovery.pipe(Effect.provide(ChangedDiffRecovery.layer)),
);
