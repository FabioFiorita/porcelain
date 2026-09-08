import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it, vi } from 'vitest';
import { inspectActionConfig } from '../commands/inspect-action-config.ts';
import { GitActionProcess } from '../git-action-process.ts';
import { createIsolatedGit } from './isolated-git.ts';

const execute = promisify(execFile);
it('isolates runner system filters without changing production configuration rejection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-system-git-fixture-'));
  const { stdout } = await execute('which', ['git']);
  const realGit = stdout.trim();
  const externalConfig = join(root, 'system.gitconfig');
  const externalBin = join(root, 'external-bin');
  const externalGit = join(externalBin, 'git');
  await writeFile(
    externalConfig,
    '[filter "fixture"]\nclean = fixture-system-filter\n',
  );
  await mkdir(externalBin);
  await writeFile(
    externalGit,
    `#!/bin/sh\nexport GIT_CONFIG_SYSTEM='${externalConfig.replaceAll("'", "'\\''")}'\nexec '${realGit.replaceAll("'", "'\\''")}' "$@"\n`,
  );
  await chmod(externalGit, 0o700);
  await execute(realGit, ['init', root]);
  vi.stubEnv('HOME', root);
  vi.stubEnv('XDG_CONFIG_HOME', root);
  vi.stubEnv('PATH', `${externalBin}:${process.env.PATH}`);
  try {
    // Model runner-owned system configuration at the executable boundary, where
    // clearing inherited Git variables in production cannot isolate it.
    await expect(
      inspectActionConfig(
        new GitActionProcess(root),
        AbortSignal.timeout(5000),
      ),
    ).rejects.toMatchObject({ reason: 'UNSUPPORTED_CONFIGURATION' });
    const isolatedBin = await createIsolatedGit(root);
    vi.stubEnv('PATH', `${isolatedBin}:${process.env.PATH}`);
    await expect(
      inspectActionConfig(
        new GitActionProcess(root),
        AbortSignal.timeout(5000),
      ),
    ).resolves.toMatch(/^[a-f0-9]{64}$/);
    const config = await new GitActionProcess(root).execute(
      ['config', '--list'],
      AbortSignal.timeout(5000),
    );
    expect(config.stdout.toString()).not.toContain('filter.fixture');
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
