import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { ActionRemote } from '../dtos/git-action-snapshot.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { ambiguousRewrite } from './inspect-action-remote.ts';
import { readActionCommand } from './read-action-command.ts';

export const pushBranch = Effect.fn('Git.pushBranch')(function* (
  process: GitProcessRunner,
  preparation: GitActionCommand<'push'>,
  remote: ActionRemote,
  sourceOid: string,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const intent = preparation.intent;
  if (!intent.allowCreate) {
    const inspectedUrl = (yield* readActionCommand(process, [
      'ls-remote',
      '--get-url',
      remote.url,
    ])).trimEnd();
    if (inspectedUrl !== remote.url) return yield* ambiguousRewrite();
    const refs = yield* readActionCommand(process, [
      'ls-remote',
      '--heads',
      remote.url,
      intent.destinationRef,
    ]);
    if (!refs.trim())
      return {
        state: 'rejected',
        reason: 'GIT_REJECTED',
        refreshRequired: false,
      };
  }
  const command = yield* process.execute([
    '-c',
    'push.autoSetupRemote=false',
    'push',
    '--progress',
    '--porcelain',
    '--no-follow-tags',
    '--recurse-submodules=no',
    remote.name,
    `${sourceOid}:${intent.destinationRef}`,
  ]);
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
      sourceOid: sourceOid,
      destinationRef: intent.destinationRef,
    },
    refreshRequired: true,
  };
});
