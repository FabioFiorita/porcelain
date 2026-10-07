import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import {
  DISCARDED_REF_PREFIX,
  parseRecoveryBlob,
} from '../../shared/parsers/recovery-blob.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';
import { removeAppliedStash } from './remove-applied-stash.ts';

export const applyStash = Effect.fn('Git.applyStash')(function* (
  process: GitProcessRunner,
  command: GitActionCommand<'stash-apply' | 'stash-pop'>,
  stashLog: string,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const intent = command.intent;
  const objectType = (yield* readActionCommand(process, [
    'cat-file',
    '-t',
    intent.stashOid,
  ])).trimEnd();
  if (objectType === 'blob') return yield* applyRecoveryBlob(process, intent);
  const result = { stashOid: intent.stashOid, stashRetained: true };
  const applied = yield* process.execute([
    'stash',
    'apply',
    ...(intent.restoreIndex ? ['--index'] : []),
    intent.stashOid,
  ]);
  const failure = processFailure(applied);
  if (failure) {
    if (failure.state === 'indeterminate') return { ...failure, result };
    const unmerged = yield* readActionCommand(process, [
      'ls-files',
      '--unmerged',
      '-z',
    ]);
    return { ...failure, ...(unmerged ? { state: 'conflicted' } : {}), result };
  }
  if (intent.action === 'stash-apply')
    return { state: 'succeeded', result, refreshRequired: true };
  return yield* removeAppliedStash(process, intent.stashOid, stashLog);
});

const applyRecoveryBlob = Effect.fn('Git.applyRecoveryBlob')(function* (
  process: GitProcessRunner,
  intent: GitActionCommand<'stash-apply' | 'stash-pop'>['intent'],
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const oid = intent.stashOid;
  const refs = (yield* readActionCommand(process, [
    'for-each-ref',
    '--format=%(refname)',
    '--points-at',
    oid,
    DISCARDED_REF_PREFIX,
  ]))
    .trimEnd()
    .split('\n')
    .filter(Boolean);
  const [ref] = refs;
  if (refs.length !== 1 || ref === undefined)
    return {
      state: 'rejected',
      reason: 'GIT_REJECTED',
      message: 'The discarded hunk recovery object is no longer available.',
      refreshRequired: false,
    };
  const content = yield* readActionCommand(process, ['cat-file', 'blob', oid]);
  const blob = parseRecoveryBlob(content);
  const patches = blob
    ? [
        { patch: blob.cached, index: intent.restoreIndex, zero: blob.zero },
        { patch: blob.unstaged, index: false, zero: blob.zero },
      ]
    : [{ patch: content, index: false, zero: true }];
  const retained = { stashOid: oid, stashRetained: true };
  for (const item of patches) {
    if (!item.patch) continue;
    const applied = yield* process.execute(
      [
        'apply',
        ...(item.index ? ['--index'] : []),
        ...(item.zero ? ['--unidiff-zero'] : []),
        '--whitespace=nowarn',
        '-',
      ],
      item.patch,
    );
    const failure = processFailure(applied);
    if (failure) return { ...failure, result: retained };
  }
  if (intent.action === 'stash-apply')
    return { state: 'succeeded', result: retained, refreshRequired: true };
  const removed = yield* process.execute(['update-ref', '-d', ref]);
  const failure = processFailure(removed);
  if (failure) return { ...failure, result: retained };
  return {
    state: 'succeeded',
    result: { stashOid: oid, stashRetained: false },
    refreshRequired: true,
  };
});
