import { afterEach, expect, it, vi } from 'vitest';
import { GitCommandError } from './errors/git-command-error.ts';
import { ReadLimitExceededError } from './errors/read-limit-exceeded-error.ts';
import { readHistory } from './read-history.ts';
import * as execution from './run-git.ts';

// These failures come from the process API, independently of repository contents.
afterEach(() => vi.restoreAllMocks());
it('preserves timeout diagnostics while classifying a killed read as a service deadline failure', async () => {
  const cause = new GitCommandError(
    '/fixture',
    ['rev-list'],
    Object.assign(new Error('killed'), { killed: true }),
  );
  vi.spyOn(execution, 'runGitRead').mockRejectedValue(cause);
  await expect(readHistory('/fixture', ['rev-list'])).rejects.toMatchObject({
    name: 'TimeoutError',
    cause,
  });
});
it('reports subprocess output overflow as a limit failure rather than a missing snapshot', async () => {
  const cause = new GitCommandError(
    '/fixture',
    ['diff-tree'],
    Object.assign(new Error('overflow'), {
      code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
      killed: true,
    }),
  );
  vi.spyOn(execution, 'runGitRead').mockRejectedValue(cause);
  const failure = readHistory('/fixture', ['diff-tree']);
  await expect(failure).rejects.toBeInstanceOf(ReadLimitExceededError);
  await expect(failure).rejects.toMatchObject({ cause });
});
