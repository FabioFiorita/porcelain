import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { nullOidFor } from '../../shared/parsers/oid.ts';
import {
  discardedRef,
  type RecoveryBlob,
  writeRecoveryBlob,
} from '../../shared/parsers/recovery-blob.ts';
import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export const saveRecoveryBlob = Effect.fn('Git.saveRecoveryBlob')(function* (
  process: GitProcessRunner,
  blob: RecoveryBlob,
): Effect.fn.Return<
  { oid: string } | { failure: GitActionOutcome },
  ActionFailure,
  ActionPlatform
> {
  const created = yield* process.execute(
    ['hash-object', '-w', '--stdin'],
    writeRecoveryBlob(blob),
  );
  const createFailure = processFailure(created);
  if (createFailure) return { failure: createFailure };
  const oid = created.stdout.toString('utf8').trimEnd();
  const saved = yield* process.execute([
    'update-ref',
    discardedRef(blob.id),
    oid,
    nullOidFor(oid),
  ]);
  const saveFailure = processFailure(saved);
  if (saveFailure) return { failure: saveFailure };
  return { oid };
});
