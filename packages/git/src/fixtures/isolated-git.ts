import { execFile } from 'node:child_process';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Production deliberately removes inherited Git configuration overrides. Keep
// fixture isolation at its executable boundary, rather than weakening that policy.
export async function createIsolatedGit(root: string): Promise<string> {
  const { stdout } = await promisify(execFile)('which', ['git']);
  const executable = stdout.trim().replaceAll("'", "'\\''");
  const directory = join(root, 'isolated-git-bin');
  await mkdir(directory);
  const wrapper = join(directory, 'git');
  await writeFile(
    wrapper,
    `#!/bin/sh\nexport GIT_CONFIG_NOSYSTEM=1\nexec '${executable}' "$@"\n`,
  );
  await chmod(wrapper, 0o700);
  return directory;
}
