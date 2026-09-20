import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { GitCommandError } from './errors/git-command-error.ts';
import { GitInspectionTimeoutError } from './errors/git-inspection-timeout-error.ts';
import { InspectionLimitError } from './errors/inspection-limit-error.ts';
import { runInspection } from './read-inspection.ts';
import { runGitRead } from './run-git.ts';

afterEach(() => vi.unstubAllEnvs());

it('aborts a running Git subprocess and retains cancellation as the failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-cancel-git-'));
  try {
    const binary = join(root, 'git');
    await writeFile(binary, '#!/bin/sh\nexec /bin/sleep 60\n');
    await chmod(binary, 0o700);
    vi.stubEnv('PATH', root);
    const controller = new AbortController();
    const task = runGitRead(root, ['status'], controller.signal);
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
    await expect(runGitRead(root, ['status'])).rejects.toMatchObject({
      name: GitCommandError.name,
      cause: { code: 'ENOENT' },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('discovers the selected checkout without inherited command-scoped Git overrides', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-git-environment-'));
  try {
    await runGitRead(root, ['init', '-b', 'main']);
    vi.stubEnv('GIT_CONFIG_PARAMETERS', "'core.bare=true'");
    vi.stubEnv('GIT_CONFIG_COUNT', '1');
    vi.stubEnv('GIT_CONFIG_KEY_0', 'core.bare');
    vi.stubEnv('GIT_CONFIG_VALUE_0', 'true');
    vi.stubEnv('GIT_DIR', join(root, 'unrelated'));
    vi.stubEnv('GIT_WORK_TREE', join(root, 'unrelated'));
    vi.stubEnv('GIT_COMMON_DIR', join(root, 'unrelated'));
    expect(
      (await runGitRead(root, ['rev-parse', '--is-inside-work-tree'])).toString(
        'utf8',
      ),
    ).toBe('true\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('stops a read that outgrows its output cap and reports it as a limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-read-cap-'));
  try {
    await runGitRead(root, ['init', '-b', 'main']);
    await expect(
      runInspection(root, ['--version'], undefined, { maxBytes: 4 }),
    ).rejects.toBeInstanceOf(InspectionLimitError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('stops a read that outruns its deadline and reports it as a timeout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-read-deadline-'));
  try {
    const binary = join(root, 'git');
    await writeFile(binary, '#!/bin/sh\nexec /bin/sleep 60\n');
    await chmod(binary, 0o700);
    vi.stubEnv('PATH', root);
    // The runner owns a read's deadline, so no caller signal is involved.
    await expect(
      runInspection(root, ['status'], undefined, { timeoutMs: 150 }),
    ).rejects.toBeInstanceOf(GitInspectionTimeoutError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
