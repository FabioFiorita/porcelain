import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitOrdinaryChange } from '../../inspection/index.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { selectHunk } from '../parsers/select-hunk.ts';
import { readActionCommand } from './read-action-command.ts';
import { readActionStatus } from './read-action-status.ts';
import { saveRecoveryBlob } from './save-recovery-blob.ts';

type DiscardCommand = GitActionCommand<'discard'>;

export const discardPath = Effect.fn('Git.discardPath')(function* (
  process: GitProcessRunner,
  command: DiscardCommand,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  if (command.intent.hunk)
    return yield* discardHunk(process, command, command.intent.hunk);
  const path = command.intent.path;
  const renamed = (yield* readActionStatus(process)).find(
    (change): change is GitOrdinaryChange =>
      'kind' in change && change.kind === 'renamed' && change.newPath === path,
  );
  if (renamed?.oldPath)
    return yield* discardRename(process, command, renamed.oldPath);
  const saved = yield* process.execute([
    '--literal-pathspecs',
    'stash',
    'push',
    '--include-untracked',
    '--message',
    `Porcelain discarded ${path}`,
    '--',
    path,
  ]);
  const failure = processFailure(saved);
  if (failure) return failure;
  if (/No local changes to save/iu.test(saved.stdout.toString('utf8')))
    return { state: 'no-change', refreshRequired: false };
  const restoreStashOid = (yield* readActionCommand(process, [
    'rev-parse',
    '--verify',
    'refs/stash',
  ])).trimEnd();
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
});

const discardHunk = Effect.fn('Git.discardHunk')(function* (
  process: GitProcessRunner,
  command: DiscardCommand,
  hunk: { scope: 'staged' | 'unstaged'; startLine: number; endLine: number },
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const staged = hunk.scope === 'staged';
  const diff = yield* readActionCommand(process, [
    '--literal-pathspecs',
    'diff',
    ...(staged ? ['--cached'] : []),
    '--no-ext-diff',
    '--no-textconv',
    '--unified=0',
    '--',
    command.intent.path,
  ]);
  const selection = selectHunk(diff, hunk);
  if (selection.kind === 'partial')
    return yield* new GitActionRejectedError({
      reason: 'UNSUPPORTED_CONFIGURATION',
      detail:
        'The selected lines cover only part of a change. Select the whole change to discard it.',
    });
  if (selection.kind === 'missing')
    return yield* new GitActionRejectedError({
      reason: 'CHANGED_SINCE_LOOKED',
    });
  const saved = yield* saveRecoveryBlob(process, {
    id: command.id,
    path: command.intent.path,
    kind: 'hunk',
    cached: staged ? selection.patch : '',
    unstaged: staged ? '' : selection.patch,
    zero: true,
  });
  if ('failure' in saved) return saved.failure;
  const applied = yield* process.execute(
    [
      'apply',
      '--reverse',
      ...(staged ? ['--index'] : []),
      '--unidiff-zero',
      '--whitespace=nowarn',
      '-',
    ],
    selection.patch,
  );
  const applyFailure = processFailure(applied);
  if (applyFailure) return applyFailure;
  return {
    state: 'succeeded',
    result: { restoreStashOid: saved.oid, stashRetained: true },
    refreshRequired: true,
  };
});

const discardRename = Effect.fn('Git.discardRename')(function* (
  process: GitProcessRunner,
  command: DiscardCommand,
  renamedFrom: string,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const path = command.intent.path;
  const paths = [renamedFrom, path];
  const cached = yield* readActionCommand(process, [
    '--literal-pathspecs',
    'diff',
    '--cached',
    '--binary',
    '--full-index',
    '--',
    ...paths,
  ]);
  const unstaged = yield* readActionCommand(process, [
    '--literal-pathspecs',
    'diff',
    '--binary',
    '--full-index',
    '--',
    ...paths,
  ]);
  const saved = yield* saveRecoveryBlob(process, {
    id: command.id,
    path,
    kind: 'rename',
    cached,
    unstaged,
    zero: false,
  });
  if ('failure' in saved)
    return yield* new GitActionRejectedError({
      reason: saved.failure.reason ?? 'GIT_REJECTED',
    });
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
    const reverted = yield* process.execute(args);
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
});
