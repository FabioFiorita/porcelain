import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';
import { removeAppliedStash } from './remove-applied-stash.ts';

export async function applyStash(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  snapshot: GitActionSnapshot,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  if (intent.action !== 'stash-apply' && intent.action !== 'stash-pop')
    throw new Error('Invalid stash intent');
  const objectType = (
    await readActionCommand(
      process,
      ['cat-file', '-t', intent.stashOid],
      signal,
    )
  ).trimEnd();
  if (objectType === 'blob') {
    const refs = (
      await readActionCommand(
        process,
        [
          'for-each-ref',
          '--format=%(refname)',
          '--points-at',
          intent.stashOid,
          'refs/porcelain/discarded/',
        ],
        signal,
      )
    )
      .trimEnd()
      .split('\n')
      .filter(Boolean);
    if (refs.length !== 1)
      return {
        state: 'rejected',
        reason: 'GIT_REJECTED',
        message: 'The discarded hunk recovery object is no longer available.',
        refreshRequired: false,
      };
    const patch = await readActionCommand(
      process,
      ['cat-file', 'blob', intent.stashOid],
      signal,
    );
    const bundle = parseDiscardBundle(patch);
    const patches: { patch: string; index: boolean; zero?: boolean }[] = bundle
      ? [
          { patch: bundle.cached, index: true, zero: bundle.zero },
          { patch: bundle.unstaged, index: false, zero: bundle.zero },
        ]
      : [{ patch, index: false, zero: true }];
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
      const applyFailure = processFailure(applied);
      if (applyFailure)
        return {
          ...applyFailure,
          result: { stashOid: intent.stashOid, stashRetained: true },
        };
    }
    const removed = await process.execute(
      ['update-ref', '-d', refs[0] ?? ''],
      signal,
    );
    const removeFailure = processFailure(removed);
    if (removeFailure)
      return {
        ...removeFailure,
        result: { stashOid: intent.stashOid, stashRetained: true },
      };
    return {
      state: 'succeeded',
      result: { stashOid: intent.stashOid, stashRetained: false },
      refreshRequired: true,
    };
  }
  const result = { stashOid: intent.stashOid, stashRetained: true };
  const command = await process.execute(
    [
      'stash',
      'apply',
      ...(intent.restoreIndex ? ['--index'] : []),
      intent.stashOid,
    ],
    signal,
  );
  const failure = processFailure(command);
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
  return removeAppliedStash(process, intent.stashOid, snapshot, signal);
}

function parseDiscardBundle(
  value: string,
): { cached: string; unstaged: string; zero: boolean } | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'porcelainDiscard' in parsed &&
      parsed.porcelainDiscard === 1 &&
      'cached' in parsed &&
      typeof parsed.cached === 'string' &&
      'unstaged' in parsed &&
      typeof parsed.unstaged === 'string'
    )
      return {
        cached: parsed.cached,
        unstaged: parsed.unstaged,
        zero: 'zero' in parsed && parsed.zero === true,
      };
  } catch {
  }
  return undefined;
}
