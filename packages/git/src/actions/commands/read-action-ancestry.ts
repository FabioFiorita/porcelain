import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export type ActionAncestry =
  | { kind: 'ancestor' }
  | { kind: 'not-ancestor' }
  | { kind: 'failed'; outcome: GitActionOutcome };

export async function readActionAncestry(
  process: GitProcessRunner,
  ancestor: string,
  descendant: string,
  signal: AbortSignal,
): Promise<ActionAncestry> {
  const result = await process.execute(
    ['merge-base', '--is-ancestor', ancestor, descendant],
    signal,
  );
  const failure = processFailure(result);
  if (failure?.state === 'indeterminate')
    return { kind: 'failed', outcome: failure };
  if (result.exitCode === 1) return { kind: 'not-ancestor' };
  if (failure) return { kind: 'failed', outcome: failure };
  return { kind: 'ancestor' };
}
