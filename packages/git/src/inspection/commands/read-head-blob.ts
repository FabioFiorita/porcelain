import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { GitOutputLimitError } from '../../shared/errors/git-output-limit-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runGitRead } from '../../shared/commands/run-git.ts';
import type { HeadBlob, HeadBlobRequest } from '../dtos/head-blob.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';

const ABSENT = 1;

export async function readHeadBlob(
  session: Pick<CheckoutSession, 'path'>,
  request: HeadBlobRequest,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<HeadBlob> {
  const oid = await readBlobOid(session.path, request.path, limits, signal);
  if (oid === undefined) return { kind: 'missing' };
  try {
    const bytes = await runGitRead(
      session.path,
      ['cat-file', 'blob', oid],
      limits,
      signal,
      { maxBytes: request.maxBytes },
    );
    signal?.throwIfAborted();
    return { kind: 'bytes', bytes };
  } catch (cause) {
    if (cause instanceof GitOutputLimitError) return { kind: 'too-large' };
    throw cause;
  }
}

async function readBlobOid(
  checkout: string,
  path: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string | undefined> {
  try {
    const output = await runGitRead(
      checkout,
      ['rev-parse', '--verify', '--quiet', `HEAD:${path}`],
      limits,
      signal,
    );
    return output.toString('utf8').trim();
  } catch (cause) {
    if (cause instanceof GitCommandError && cause.exitCode === ABSENT)
      return undefined;
    throw cause;
  }
}
