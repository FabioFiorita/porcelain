import { createHash } from 'node:crypto';
import { lstat, readFile, readlink, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export async function hashActionFiles(
  checkout: string,
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<string> {
  const names = (
    await readActionCommand(
      process,
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      signal,
    )
  )
    .split('\0')
    .filter(Boolean);
  if (names.length > 10_000)
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
  const checkoutRoot = await realpath(checkout);
  const hash = createHash('sha256');
  const size = { bytes: 0 };
  for (const name of [...new Set(names)].sort()) {
    signal.throwIfAborted();
    const path = join(checkout, name);
    const relativePath = relative(checkout, path);
    if (isAbsolute(name) || relativePath.startsWith('..'))
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
    hash.update(name).update('\0');
    const parent = await realpath(dirname(path)).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return checkoutRoot;
      throw error;
    });
    const parentRelative = relative(checkoutRoot, parent);
    if (isAbsolute(parentRelative) || parentRelative.startsWith('..'))
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
    const content = await fileContent(path);
    size.bytes += content.length;
    if (size.bytes > 32 * 1024 * 1024)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function fileContent(path: string): Promise<Buffer> {
  try {
    const info = await lstat(path);
    if (
      (!info.isFile() && !info.isSymbolicLink()) ||
      info.size > 32 * 1024 * 1024
    )
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
    const content = info.isSymbolicLink()
      ? Buffer.from(await readlink(path))
      : await readFile(path);
    return Buffer.concat([Buffer.from(`${info.mode}\0`), content]);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return Buffer.from('missing');
    throw error;
  }
}
