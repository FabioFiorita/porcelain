import { type Context, Effect } from 'effect';
import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';

export const readWorktreeFingerprints = Effect.fn(
  'Changes.readWorktreeFingerprints',
)(function* (
  statusReader: Context.Service.Shape<typeof ReadWorktreeStatusService>,
  fingerprintReader: Context.Service.Shape<
    typeof ReadChangeFingerprintsService
  >,
  worktreeId: string,
) {
  const status = yield* statusReader.execute({ worktreeId });
  const { changes } = yield* fingerprintReader.execute({
    worktreeId,
    comparisons: status.changes,
    paths: undefined,
  });
  return { status, changes };
});
