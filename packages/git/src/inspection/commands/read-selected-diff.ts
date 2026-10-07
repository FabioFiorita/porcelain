import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from './run-inspection.ts';

const selectedDiff = Effect.fn('Git.readSelectedDiff')(function* (
  session: Pick<EffectCheckoutSession, 'path'>,
  headOid: string | null,
  paths: readonly string[],
  limits: GitLimits,
) {
  const output = yield* runInspection(
    session.path,
    [
      'diff',
      ...(headOid ? [headOid] : ['--cached']),
      '--no-ext-diff',
      '--no-textconv',
      `--unified=${limits.inspection.contextLines}`,
      '--',
      ...paths,
    ],
    limits,
    {
      maxBytes: limits.inspection.selectedDiffBytes,
      leading: ['--literal-pathspecs'],
    },
  );
  return output.toString('utf8');
});

export const readSelectedDiff = Effect.fn('Git.selectedDiff')(function* (
  session: EffectCheckoutSession,
  headOid: string | null,
  paths: readonly string[],
  limits: GitLimits,
) {
  yield* session.verify();
  const output = yield* selectedDiff(session, headOid, paths, limits);
  yield* session.confirm();
  return output;
});
