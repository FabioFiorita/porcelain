import {
  DISCARDED_REF_PREFIX,
  parseRecoveryBlob,
} from '../../shared/recovery-blob.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';
import { removeAppliedStash } from './remove-applied-stash.ts';

export async function applyStash(
  process: GitProcessRunner,
  command: GitActionCommand<'stash-apply' | 'stash-pop'>,
  stashLog: string,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = command.intent;
  const objectType = (
    await readActionCommand(
      process,
      ['cat-file', '-t', intent.stashOid],
      signal,
    )
  ).trimEnd();
  if (objectType === 'blob')
    return applyRecoveryBlob(process, intent.stashOid, signal);
  const result = { stashOid: intent.stashOid, stashRetained: true };
  const applied = await process.execute(
    [
      'stash',
      'apply',
      ...(intent.restoreIndex ? ['--index'] : []),
      intent.stashOid,
    ],
    signal,
  );
  const failure = processFailure(applied);
  if (failure) {
    if (failure.state === 'indeterminate') return { ...failure, result };
    const unmerged = await readActionCommand(
      process,
      ['ls-files', '--unmerged', '-z'],
      signal,
    );
    return { ...failure, ...(unmerged ? { state: 'conflicted' } : {}), result };
  }
  if (intent.action === 'stash-apply')
    return { state: 'succeeded', result, refreshRequired: true };
  return removeAppliedStash(process, intent.stashOid, stashLog, signal);
}

async function applyRecoveryBlob(
  process: GitProcessRunner,
  oid: string,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const refs = (
    await readActionCommand(
      process,
      [
        'for-each-ref',
        '--format=%(refname)',
        '--points-at',
        oid,
        DISCARDED_REF_PREFIX,
      ],
      signal,
    )
  )
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
  const content = await readActionCommand(
    process,
    ['cat-file', 'blob', oid],
    signal,
  );
  const blob = parseRecoveryBlob(content);
  const patches = blob
    ? [
        { patch: blob.cached, index: true, zero: blob.zero },
        { patch: blob.unstaged, index: false, zero: blob.zero },
      ]
    : [{ patch: content, index: false, zero: true }];
  const retained = { stashOid: oid, stashRetained: true };
  for (const item of patches) {
    if (!item.patch) continue;
    const applied = await process.execute(
      [
        'apply',
        ...(item.index ? ['--index'] : []),
        ...(item.zero ? ['--unidiff-zero'] : []),
        '--whitespace=nowarn',
        '-',
      ],
      signal,
      item.patch,
    );
    const failure = processFailure(applied);
    if (failure) return { ...failure, result: retained };
  }
  const removed = await process.execute(['update-ref', '-d', ref], signal);
  const failure = processFailure(removed);
  if (failure) return { ...failure, result: retained };
  return {
    state: 'succeeded',
    result: { stashOid: oid, stashRetained: false },
    refreshRequired: true,
  };
}
