import type { GitOrdinaryChange } from '../../inspection/index.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { selectHunk } from '../parsers/select-hunk.ts';
import { readActionCommand } from './read-action-command.ts';
import { readActionStatus } from './read-action-status.ts';
import { saveRecoveryBlob } from './save-recovery-blob.ts';

type DiscardCommand = GitActionCommand<'discard'>;

export async function discardPath(
  process: GitProcessRunner,
  command: DiscardCommand,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  if (command.intent.hunk)
    return discardHunk(process, command, command.intent.hunk, signal);
  const path = command.intent.path;
  const renamed = (await readActionStatus(process, signal)).find(
    (change): change is GitOrdinaryChange =>
      'kind' in change && change.kind === 'renamed' && change.newPath === path,
  );
  if (renamed?.oldPath)
    return discardRename(process, command, renamed.oldPath, signal);
  const saved = await process.execute(
    [
      '--literal-pathspecs',
      'stash',
      'push',
      '--include-untracked',
      '--message',
      `Porcelain discarded ${path}`,
      '--',
      path,
    ],
    signal,
  );
  const failure = processFailure(saved);
  if (failure) return failure;
  if (/No local changes to save/iu.test(saved.stdout.toString('utf8')))
    return { state: 'no-change', refreshRequired: false };
  const restoreStashOid = (
    await readActionCommand(
      process,
      ['rev-parse', '--verify', 'refs/stash'],
      signal,
    )
  ).trimEnd();
  return {
    state: 'succeeded',
    result: {
      stashOid: restoreStashOid,
      stashRetained: true,
      restoreStashOid,
      restoreIndex: true,
    },
    refreshRequired: true,
  };
}

async function discardHunk(
  process: GitProcessRunner,
  command: DiscardCommand,
  hunk: { scope: 'staged' | 'unstaged'; startLine: number; endLine: number },
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const staged = hunk.scope === 'staged';
  const diff = await readActionCommand(
    process,
    [
      '--literal-pathspecs',
      'diff',
      ...(staged ? ['--cached'] : []),
      '--no-ext-diff',
      '--no-textconv',
      '--unified=0',
      '--',
      command.intent.path,
    ],
    signal,
  );
  const selection = selectHunk(diff, hunk);
  if (selection.kind === 'partial')
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail:
        'The selected lines cover only part of a change. Select the whole change to discard it.',
    });
  if (selection.kind === 'missing')
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
  const saved = await saveRecoveryBlob(
    process,
    {
      id: command.id,
      path: command.intent.path,
      kind: 'hunk',
      cached: staged ? selection.patch : '',
      unstaged: staged ? '' : selection.patch,
      zero: true,
    },
    signal,
  );
  if ('failure' in saved) return saved.failure;
  const applied = await process.execute(
    [
      'apply',
      '--reverse',
      ...(staged ? ['--index'] : []),
      '--unidiff-zero',
      '--whitespace=nowarn',
      '-',
    ],
    signal,
    selection.patch,
  );
  const applyFailure = processFailure(applied);
  if (applyFailure) return applyFailure;
  return {
    state: 'succeeded',
    result: { restoreStashOid: saved.oid, stashRetained: true },
    refreshRequired: true,
  };
}

async function discardRename(
  process: GitProcessRunner,
  command: DiscardCommand,
  renamedFrom: string,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const path = command.intent.path;
  const paths = [renamedFrom, path];
  const cached = await readActionCommand(
    process,
    [
      '--literal-pathspecs',
      'diff',
      '--cached',
      '--binary',
      '--full-index',
      '--',
      ...paths,
    ],
    signal,
  );
  const unstaged = await readActionCommand(
    process,
    ['--literal-pathspecs', 'diff', '--binary', '--full-index', '--', ...paths],
    signal,
  );
  const saved = await saveRecoveryBlob(
    process,
    { id: command.id, path, kind: 'rename', cached, unstaged, zero: false },
    signal,
  );
  if ('failure' in saved)
    throw new GitActionRejectedError(saved.failure.reason ?? 'GIT_REJECTED');
  for (const args of [
    [
      '--literal-pathspecs',
      'restore',
      '--source=HEAD',
      '--staged',
      '--worktree',
      '--',
      renamedFrom,
    ],
    [
      '--literal-pathspecs',
      'rm',
      '-f',
      '--cached',
      '--ignore-unmatch',
      '--',
      path,
    ],
    ['--literal-pathspecs', 'clean', '-f', '--', path],
  ]) {
    const reverted = await process.execute(args, signal);
    const failure = processFailure(reverted);
    if (failure) return failure;
  }
  return {
    state: 'succeeded',
    result: {
      restoreStashOid: saved.oid,
      stashRetained: true,
      restoreIndex: true,
    },
    refreshRequired: true,
  };
}
