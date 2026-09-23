import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runGitRead } from '../../shared/run-git.ts';

export async function readSelectedDiff(
  session: CheckoutSession,
  headOid: string | null,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<string> {
  await session.verify(signal);
  const output = await runGitRead(
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
    signal,
    {
      maxBytes: 1024 * 1024,
      leading: ['--literal-pathspecs'],
    },
  );
  await session.confirm(signal);
  return output.toString('utf8');
}
