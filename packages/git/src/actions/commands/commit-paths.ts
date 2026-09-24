import {
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isRelativePath } from '@porcelain/kernel/rules';
import { isMissing } from '../../shared/errors/is-missing.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { readOptionalActionOid } from './read-optional-action-oid.ts';
import { rejectBusyCheckout } from './reject-busy-checkout.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionBranch } from './read-action-branch.ts';
import { readActionCommand } from './read-action-command.ts';
import { readActionHead } from './read-action-head.ts';

export async function commitPaths(
  process: GitProcessRunner,
  preparation: GitActionCommand<'commit' | 'amend'>,
  paths: readonly string[],
  signal: AbortSignal,
  verifyTarget?: () => Promise<void>,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  const messageOnly = intent.action === 'amend' && paths.length === 0;
  const merging =
    intent.action === 'commit' && preparation.preview.inProgress === 'merge';
  if (intent.action === 'commit' && paths.length === 0 && !merging)
    throw new GitActionRejectedError('REQUEST_MISMATCH');
  if (
    paths.length > process.limits.actions.maxCommitPaths ||
    paths.some(
      (path) => !isRelativePath(path, process.limits.inspection.maxPathLength),
    )
  )
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail: `Porcelain commits at most ${process.limits.actions.maxCommitPaths.toLocaleString('en-US')} files at once, each inside the checkout and outside \`.git\`. Select fewer files and try again.`,
    });
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
    const inProgress = await rejectBusyCheckout(process, signal, true, true);
    const mergeHeadOid =
      inProgress === 'merge'
        ? await readOptionalActionOid(process, 'MERGE_HEAD', signal)
        : null;
    const headOid = await readOptionalActionOid(process, 'HEAD', signal);
    const branch = await readActionBranch(process, signal);
    if (
      headOid !== preparation.preview.headOid ||
      branch !== preparation.preview.branch ||
      inProgress !== (preparation.preview.inProgress ?? null) ||
      mergeHeadOid !== (preparation.preview.mergeHeadOid ?? null)
    )
      throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
    await verifyTarget?.();
    temporary = await mkdtemp(join(dirname(indexPath), 'porcelain-index-'));
    const indexFile = join(temporary, 'index');
    const original = await readFile(indexPath).catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
    if (original) await writeFile(indexFile, original);
    const pathsFile = join(temporary, 'paths');
    await writeFile(pathsFile, `${paths.join('\0')}\0`);
    const run = (args: string[], input?: string) =>
      process.execute(['--literal-pathspecs', ...args], signal, input, {
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
    const addPaths = paths.filter((path) => present.has(path));
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
    await writeFile(pathsFile, `${paths.join('\0')}\0`);
    if (!messageOnly && !merging) {
      const changed = await run([
        'diff',
        '--cached',
        '--quiet',
        '--no-ext-diff',
        '--no-textconv',
        '--',
        ...paths,
      ]);
      if (!changed.interrupted && changed.exitCode === 0)
        return { state: 'no-change', refreshRequired: false };
      if (changed.interrupted || changed.exitCode !== 1)
        return (
          processFailure(changed) ?? {
            state: 'rejected',
            refreshRequired: true,
          }
        );
    }
    const committed = await run(
      [
        'commit',
        ...(intent.action === 'amend' ? ['--amend'] : []),
        ...(!merging ? ['--only'] : []),
        '--file=-',
        '--cleanup=verbatim',
        ...(!merging && !messageOnly
          ? [`--pathspec-from-file=${pathsFile}`, '--pathspec-file-nul']
          : []),
      ],
      intent.message,
    );
    const failure = processFailure(committed);
    if (failure?.state === 'rejected') return failure;
    const head = await readActionHead(
      process,
      AbortSignal.timeout(process.limits.followUpTimeoutMs),
    );
    if (head !== preparation.preview.headOid && !messageOnly) {
      await lock.writeFile(await readFile(indexFile));
      await lock.sync();
      await lock.close();
      await rename(lockPath, indexPath);
      published = true;
    }
    if (failure) return failure;
    if (head === preparation.preview.headOid)
      return {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
      };
    return published || messageOnly
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
