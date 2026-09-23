import { createHash } from 'node:crypto';
import { lstat, readFile, readlink, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../../shared/interfaces/git-process-runner.ts';
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
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail: `This checkout has ${names.length.toLocaleString('en-US')} files. Porcelain checks at most 10,000 before an action. ${TERMINAL}`,
    });
  const checkoutRoot = await realpath(checkout);
  const hash = createHash('sha256');
  const size = { bytes: 0 };
  for (const name of [...new Set(names)].sort()) {
    signal.throwIfAborted();
    const path = join(checkout, name);
    const relativePath = relative(checkout, path);
    if (isAbsolute(name) || relativePath.startsWith('..'))
      throw outsideCheckout(name);
    hash.update(name).update('\0');
    const parent = await realpath(dirname(path)).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return checkoutRoot;
      throw error;
    });
    const parentRelative = relative(checkoutRoot, parent);
    if (isAbsolute(parentRelative) || parentRelative.startsWith('..'))
      throw outsideCheckout(name);
    const content = await fileContent(path, name);
    size.bytes += content.length;
    if (size.bytes > 32 * 1024 * 1024)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `The files in this checkout add up to more than 32 MB, the most Porcelain checks before an action. ${TERMINAL}`,
      });
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

const TERMINAL = 'Run this action from a terminal instead.';

function outsideCheckout(name: string): GitActionRejectedError {
  return new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
    detail: `\`${name}\` is reached through a folder link that leaves the checkout, so Porcelain cannot check it. ${TERMINAL}`,
  });
}

async function fileContent(path: string, name: string): Promise<Buffer> {
  try {
    const info = await lstat(path);
    if (
      (!info.isFile() && !info.isSymbolicLink()) ||
      info.size > 32 * 1024 * 1024
    )
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `\`${name}\` is ${info.isFile() ? 'larger than 32 MB' : 'not a regular file'}, so Porcelain cannot check it before an action. ${TERMINAL}`,
      });
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
