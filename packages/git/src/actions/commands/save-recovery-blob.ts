import { nullOidFor } from '../../shared/oid.ts';
import {
  discardedRef,
  type RecoveryBlob,
  writeRecoveryBlob,
} from '../../shared/recovery-blob.ts';
import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export async function saveRecoveryBlob(
  process: GitProcessRunner,
  blob: RecoveryBlob,
  signal: AbortSignal,
): Promise<{ oid: string } | { failure: GitActionOutcome }> {
  const created = await process.execute(
    ['hash-object', '-w', '--stdin'],
    signal,
    writeRecoveryBlob(blob),
  );
  const createFailure = processFailure(created);
  if (createFailure) return { failure: createFailure };
  const oid = created.stdout.toString('utf8').trimEnd();
  const saved = await process.execute(
    ['update-ref', discardedRef(blob.id), oid, nullOidFor(oid)],
    signal,
  );
  const saveFailure = processFailure(saved);
  if (saveFailure) return { failure: saveFailure };
  return { oid };
}
