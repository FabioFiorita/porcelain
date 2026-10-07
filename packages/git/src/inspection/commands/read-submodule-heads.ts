import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { parseSubmoduleStatus } from '../parsers/parse-submodule-status.ts';
import { runInspection } from './run-inspection.ts';

export const readSubmoduleHeads = Effect.fn('Git.readSubmoduleHeads')(
  function* (
    session: EffectCheckoutSession,
    paths: readonly string[],
    limits: GitLimits,
  ) {
    const wanted = [...new Set(paths)];
    if (wanted.length === 0) return new Map();
    const output = yield* runInspection(
      session.path,
      ['submodule', 'status', '--', ...wanted],
      limits,
      { maxBytes: limits.inspection.submoduleStatusBytes },
    );
    return parseSubmoduleStatus(output.toString('utf8'), wanted);
  },
);
