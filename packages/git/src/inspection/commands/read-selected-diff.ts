import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from './run-inspection.ts';

export async function readSelectedDiff(
  session: CheckoutSession,
  headOid: string | null,
  paths: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string> {
  await session.verify(signal);
  const output = await runInspection(
    session.path,
    [
      'diff',
      ...(headOid ? [headOid] : ['--cached']),
      '--no-ext-diff',
      '--no-textconv',
      '--unified=3',
      '--',
      ...paths,
    ],
    limits,
    signal,
    {
      maxBytes: limits.inspection.selectedDiffBytes,
      leading: ['--literal-pathspecs'],
    },
  );
  await session.confirm(signal);
  return output.toString('utf8');
}
