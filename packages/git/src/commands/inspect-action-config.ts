import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { validateActionConfig } from '../helpers/validate-action-config.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionConfig(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<string> {
  const config = await readActionCommand(
    process,
    ['config', '--null', '--list'],
    signal,
  );
  validateActionConfig(config);
  const hash = createHash('sha256').update(config);
  const hooks = (
    await readActionCommand(
      process,
      ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
      signal,
    )
  ).trimEnd();
  try {
    for (const name of (await readdir(hooks)).sort()) {
      if (name.endsWith('.sample')) continue;
      const path = join(hooks, name);
      const info = await lstat(path);
      if (!info.isFile() || info.size > 1024 * 1024)
        throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
      hash
        .update(name)
        .update(String(info.mode))
        .update(await readFile(path));
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  return hash.digest('hex');
}
