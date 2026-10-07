import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

type ActionAncestry =
  | { kind: 'ancestor' }
  | { kind: 'not-ancestor' }
  | { kind: 'failed'; outcome: GitActionOutcome };

export const readActionAncestry = Effect.fn('Git.readActionAncestry')(
  function* (
    process: GitProcessRunner,
    ancestor: string,
    descendant: string,
  ): Effect.fn.Return<ActionAncestry, ActionFailure, ActionPlatform> {
    const result = yield* process.execute([
      'merge-base',
      '--is-ancestor',
      ancestor,
      descendant,
    ]);
    const failure = processFailure(result);
    if (failure?.state === 'indeterminate')
      return { kind: 'failed', outcome: failure };
    if (result.exitCode === 1) return { kind: 'not-ancestor' };
    if (failure) return { kind: 'failed', outcome: failure };
    return { kind: 'ancestor' };
  },
);
