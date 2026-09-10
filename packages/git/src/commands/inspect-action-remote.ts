import type { GitActionIntent } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { validateHttpsCredentialHelpers } from '../helpers/validate-https-credential-helpers.ts';
import { validateRemoteProfile } from '../helpers/validate-remote-profile.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionRemote(
  process: GitProcessRunner,
  intent: Extract<GitActionIntent, { action: 'fetch' | 'push' }>,
  signal: AbortSignal,
) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(intent.remoteName))
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
  const ref =
    intent.action === 'fetch' ? intent.sourceRef : intent.destinationRef;
  if (!ref.startsWith('refs/heads/'))
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
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
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
  const display = validateRemoteProfile(urls[0]);
  if (intent.action === 'push' && !intent.allowCreate) {
    const lookupUrl = (
      await readActionCommand(
        process,
        ['ls-remote', '--get-url', urls[0]],
        signal,
      )
    ).trimEnd();
    if (lookupUrl !== urls[0])
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
  }
  if (urls[0].startsWith('https:')) await verifyHttpsHelpers(process, signal);
  const trackingRef = `refs/remotes/${intent.remoteName}/${ref.slice('refs/heads/'.length)}`;
  await readActionCommand(process, ['check-ref-format', trackingRef], signal);
  return { name: intent.remoteName, url: urls[0], trackingRef, display };
}

async function verifyHttpsHelpers(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<void> {
  const config = await readActionCommand(
    process,
    ['config', '--null', '--list'],
    signal,
  );
  validateHttpsCredentialHelpers(config);
}
