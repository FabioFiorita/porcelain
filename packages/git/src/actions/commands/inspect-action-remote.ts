import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionIntent } from '../dtos/git-action.ts';
import type { ActionRemote } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { validateRemoteProfile } from '../parsers/validate-remote-profile.ts';
import { readActionCommand } from './read-action-command.ts';

export const inspectActionRemote = Effect.fn('Git.inspectActionRemote')(
  function* (
    process: GitProcessRunner,
    intent: Extract<GitActionIntent, { action: 'fetch' | 'pull' | 'push' }>,
  ): Effect.fn.Return<ActionRemote, ActionFailure, ActionPlatform> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(intent.remoteName))
      return yield* new GitActionRejectedError({
        reason: 'UNSUPPORTED_CONFIGURATION',
        detail:
          'Porcelain only uses remotes named with letters, digits, dots, dashes and underscores. Rename the remote with `git remote rename`, or run this action from a terminal.',
      });
    const ref =
      intent.action === 'push' ? intent.destinationRef : intent.sourceRef;
    if (!ref.startsWith('refs/heads/'))
      return yield* new GitActionRejectedError({
        reason: 'UNSUPPORTED_CONFIGURATION',
        detail: `Porcelain only fetches and pushes branches, and \`${ref}\` is not one. Run this action from a terminal.`,
      });
    yield* readActionCommand(process, ['check-ref-format', ref]);
    const urls = (yield* readActionCommand(process, [
      'remote',
      'get-url',
      ...(intent.action === 'push' ? ['--push'] : []),
      '--all',
      intent.remoteName,
    ]))
      .trimEnd()
      .split('\n');
    if (urls.length !== 1 || !urls[0])
      return yield* new GitActionRejectedError({
        reason: 'UNSUPPORTED_CONFIGURATION',
        detail: `Remote ${intent.remoteName} has ${urls[0] ? urls.length : 'no'} ${intent.action === 'push' ? 'push ' : ''}URLs, and Porcelain needs exactly one. Check \`remote.${intent.remoteName}.url\`${intent.action === 'push' ? ` and \`remote.${intent.remoteName}.pushurl\`` : ''} with \`git remote -v\`, or run this action from a terminal.`,
      });
    const display = yield* validateRemoteProfile(urls[0]);
    if (intent.action === 'push' && !intent.allowCreate) {
      const lookupUrl = (yield* readActionCommand(process, [
        'ls-remote',
        '--get-url',
        urls[0],
      ])).trimEnd();
      if (lookupUrl !== urls[0]) return yield* ambiguousRewrite();
    }
    const trackingRef = `refs/remotes/${intent.remoteName}/${ref.slice('refs/heads/'.length)}`;
    yield* readActionCommand(process, ['check-ref-format', trackingRef]);
    return { name: intent.remoteName, url: urls[0], trackingRef, display };
  },
);

export function ambiguousRewrite(): GitActionRejectedError {
  return new GitActionRejectedError({
    reason: 'UNSUPPORTED_CONFIGURATION',
    detail:
      'Git config rewrites this remote URL more than once through `url.<base>.insteadOf`, so the push destination is ambiguous. Remove the extra rewrite, or run this action from a terminal.',
  });
}
