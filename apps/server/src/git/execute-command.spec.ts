import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { GitCommandError } from './errors/git-command-error.ts';
import { executeCommand } from './execute-command.ts';

afterEach(() => vi.unstubAllEnvs());

it('aborts a running Git subprocess and retains cancellation as the failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-cancel-git-'));
  try {
    const binary = join(root, 'git');
    await writeFile(binary, '#!/bin/sh\nexec /bin/sleep 60\n');
    await chmod(binary, 0o700);
    vi.stubEnv('PATH', root);
    const controller = new AbortController();
    const task = executeCommand(root, ['status'], controller.signal);
    const rejected = expect(task).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('preserves missing Git executable diagnostics instead of classifying it as missing repository data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-missing-git-'));
  try {
    vi.stubEnv('PATH', root);
    await expect(executeCommand(root, ['status'])).rejects.toMatchObject({
      name: GitCommandError.name,
      cause: { code: 'ENOENT' },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
