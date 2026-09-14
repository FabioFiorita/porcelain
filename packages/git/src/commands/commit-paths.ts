import {
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function commitPaths(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  if (intent.action !== 'commit' || !intent.paths?.length)
    throw new Error('Invalid selected commit');
  if (
    intent.paths.length > 2000 ||
    intent.paths.some(
      (path) =>
        !path ||
        path.includes('\0') ||
        path.startsWith('/') ||
        path.split('/').some((part) => ['', '.', '..', '.git'].includes(part)),
    )
  )
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
  const indexPath = (
    await readActionCommand(
      process,
      ['rev-parse', '--path-format=absolute', '--git-path', 'index'],
      signal,
    )
  ).trimEnd();
  const lockPath = `${indexPath}.lock`;
  const lock = await open(lockPath, 'wx', 0o600).catch((cause: unknown) => {
    throw new GitActionRejectedError('CHECKOUT_BUSY', { cause });
  });
  let temporary: string | undefined;
  let published = false;
  let preserve = false;
  try {
    temporary = await mkdtemp(join(dirname(indexPath), 'porcelain-index-'));
    const indexFile = join(temporary, 'index');
    const original = await readFile(indexPath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return null;
      throw error;
    });
    if (original) await writeFile(indexFile, original);
    const pathsFile = join(temporary, 'paths');
    await writeFile(pathsFile, `${intent.paths.join('\0')}\0`);
    const run = (args: string[], commandSignal = signal, input?: string) =>
      process.execute(['--literal-pathspecs', ...args], commandSignal, input, {
        indexFile,
      });
    const present = new Set(
      (
        await readActionCommand(
          process,
          ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
          signal,
        )
      ).split('\0'),
    );
    const addPaths = intent.paths.filter((path) => present.has(path));
    if (addPaths.length) {
      await writeFile(pathsFile, `${addPaths.join('\0')}\0`);
      const added = await run([
        'add',
        '--all',
        `--pathspec-from-file=${pathsFile}`,
        '--pathspec-file-nul',
      ]);
      const addFailure = processFailure(added);
      if (addFailure) return addFailure;
    }
    await writeFile(pathsFile, `${intent.paths.join('\0')}\0`);
    const changed = await run([
      'diff',
      '--cached',
      '--quiet',
      '--no-ext-diff',
      '--no-textconv',
      '--',
      ...intent.paths,
    ]);
    if (!changed.interrupted && changed.exitCode === 0)
      return { state: 'no-change', refreshRequired: false };
    if (changed.interrupted || changed.exitCode !== 1)
      return (
        processFailure(changed) ?? { state: 'rejected', refreshRequired: true }
      );
    // Git's --only updates selected paths while retaining the other staged entries.
    // An isolated index also lets new files participate without touching the real index on rejection.
    const committed = await run(
      [
        'commit',
        '--only',
        '--file=-',
        '--cleanup=verbatim',
        `--pathspec-from-file=${pathsFile}`,
        '--pathspec-file-nul',
      ],
      signal,
      intent.message,
    );
    const failure = processFailure(committed);
    if (failure?.state === 'rejected') return failure;
    const head = (
      await readActionCommand(
        process,
        ['rev-parse', '--verify', 'HEAD'],
        AbortSignal.timeout(5000),
      )
    ).trimEnd();
    if (head !== preparation.preview.headOid) {
      await lock.writeFile(await readFile(indexFile));
      await lock.sync();
      await lock.close();
      await rename(lockPath, indexPath);
      published = true;
    }
    if (failure) return failure;
    return published
      ? { state: 'succeeded', result: { headOid: head }, refreshRequired: true }
      : {
          state: 'indeterminate',
          reason: 'OUTCOME_UNKNOWN',
          refreshRequired: true,
        };
  } catch (error) {
    preserve =
      error instanceof GitActionRejectedError &&
      error.reason === 'PROCESS_GROUP_UNCONFIRMED';
    throw error;
  } finally {
    if (!published) {
      await lock.close();
      if (!preserve) await rm(lockPath, { force: true });
    }
    if (temporary && !preserve)
      await rm(temporary, { recursive: true, force: true });
  }
}
