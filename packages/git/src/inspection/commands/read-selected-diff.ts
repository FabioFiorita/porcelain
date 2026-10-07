import { Effect } from 'effect';
import { runGitEffect } from '../../shared/commands/run-git.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type {
  CheckoutSession,
  EffectCheckoutSession,
} from '../interfaces/git-session.ts';
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

export async function readSelectedDiff(
  session: CheckoutSession,
  headOid: string | null,
  paths: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string> {
  await session.verify(signal);
  const output = await runGitEffect(
    selectedDiff(session, headOid, paths, limits),
    signal,
  );
  await session.confirm(signal);
  return output;
}
