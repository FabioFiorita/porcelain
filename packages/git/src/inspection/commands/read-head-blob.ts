import { GitOutputLimitError } from '../../shared/errors/git-output-limit-error.ts';
import { runGitRead } from '../../shared/run-git.ts';
import type { HeadBlob, HeadBlobRequest } from '../dtos/head-blob.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';

export async function readHeadBlob(
  session: Pick<CheckoutSession, 'path'>,
  request: HeadBlobRequest,
  signal?: AbortSignal,
): Promise<HeadBlob> {
  try {
    const bytes = await runGitRead(
      session.path,
      ['show', `HEAD:${request.path}`],
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
