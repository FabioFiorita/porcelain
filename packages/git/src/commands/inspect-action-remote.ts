import type { GitActionIntent } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { validateRemoteProfile } from '../helpers/validate-remote-profile.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionRemote(
  process: GitProcessRunner,
  intent: Extract<GitActionIntent, { action: 'fetch' | 'pull' | 'push' }>,
  signal: AbortSignal,
) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(intent.remoteName))
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail:
        'Porcelain only uses remotes named with letters, digits, dots, dashes and underscores. Rename the remote with `git remote rename`, or run this action from a terminal.',
    });
  const ref =
    intent.action === 'push' ? intent.destinationRef : intent.sourceRef;
  if (!ref.startsWith('refs/heads/'))
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail: `Porcelain only fetches and pushes branches, and \`${ref}\` is not one. Run this action from a terminal.`,
    });
  await readActionCommand(process, ['check-ref-format', ref], signal);
  const urls = (
    await readActionCommand(
      process,
      [
        'remote',
        'get-url',
        ...(intent.action === 'push' ? ['--push'] : []),
        '--all',
        intent.remoteName,
      ],
      signal,
    )
  )
    .trimEnd()
    .split('\n');
  if (urls.length !== 1 || !urls[0])
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail: `Remote ${intent.remoteName} has ${urls[0] ? urls.length : 'no'} ${intent.action === 'push' ? 'push ' : ''}URLs, and Porcelain needs exactly one. Check \`remote.${intent.remoteName}.url\`${intent.action === 'push' ? ` and \`remote.${intent.remoteName}.pushurl\`` : ''} with \`git remote -v\`, or run this action from a terminal.`,
    });
  const display = validateRemoteProfile(urls[0]);
  if (intent.action === 'push' && !intent.allowCreate) {
    const lookupUrl = (
      await readActionCommand(
        process,
        ['ls-remote', '--get-url', urls[0]],
        signal,
      )
    ).trimEnd();
    if (lookupUrl !== urls[0]) throw ambiguousRewrite();
  }
  const trackingRef = `refs/remotes/${intent.remoteName}/${ref.slice('refs/heads/'.length)}`;
  await readActionCommand(process, ['check-ref-format', trackingRef], signal);
  return { name: intent.remoteName, url: urls[0], trackingRef, display };
}

/** A push URL that another url.<base>.insteadOf rule rewrites again. */
export function ambiguousRewrite(): GitActionRejectedError {
  return new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
    detail:
      'Git config rewrites this remote URL more than once through `url.<base>.insteadOf`, so the push destination is ambiguous. Remove the extra rewrite, or run this action from a terminal.',
  });
}
