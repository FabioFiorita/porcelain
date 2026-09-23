import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { ambiguousRewrite } from './inspect-action-remote.ts';
import { readActionCommand } from './read-action-command.ts';

export async function pushBranch(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  snapshot: GitActionSnapshot,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  if (
    intent.action !== 'push' ||
    !snapshot.remote ||
    !preparation.preview.headOid
  )
    throw new Error('Invalid push intent');
  if (!intent.allowCreate) {
    const inspectedUrl = (
      await readActionCommand(
        process,
        ['ls-remote', '--get-url', snapshot.remote.url],
        signal,
      )
    ).trimEnd();
    if (inspectedUrl !== snapshot.remote.url) throw ambiguousRewrite();
    const refs = await readActionCommand(
      process,
      ['ls-remote', '--heads', snapshot.remote.url, intent.destinationRef],
      signal,
    );
    if (!refs.trim())
      return {
        state: 'rejected',
        reason: 'GIT_REJECTED',
        refreshRequired: false,
      };
  }
  const command = await process.execute(
    [
      '-c',
      'push.autoSetupRemote=false',
      'push',
      '--progress',
      '--porcelain',
      '--no-follow-tags',
      '--recurse-submodules=no',
      snapshot.remote.name,
      `${preparation.preview.headOid}:${intent.destinationRef}`,
    ],
    signal,
  );
  const failure = processFailure(command);
  if (failure)
    return {
      ...failure,
      state: 'indeterminate',
      reason: failure.reason ?? 'OUTCOME_UNKNOWN',
    };
  const records = command.stdout
    .toString('utf8')
    .split('\n')
    .filter((line) => /^[ =*]\t/.test(line));
  if (
    records.length !== 1 ||
    !records[0]?.split('\t')[1]?.endsWith(`:${intent.destinationRef}`)
  )
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  return {
    state: records[0].startsWith('=') ? 'no-change' : 'succeeded',
    result: {
      sourceOid: preparation.preview.headOid,
      destinationRef: intent.destinationRef,
    },
    refreshRequired: true,
  };
}
