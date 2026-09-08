import { isAbsolute } from 'node:path';
import type { GitActionIntent } from '../../models/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

function validateRemoteProfile(url: string): string {
  if (isAbsolute(url)) return 'local repository';
  if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:[^\s]+$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (
      !['https:', 'ssh:'].includes(parsed.protocol) ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol === 'https:' && parsed.username)
    )
      throw new Error('Unsupported remote');
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch (cause) {
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', { cause });
  }
}

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
  // --get-urlmatch returns only the final value, but helpers are a chain. Inspect
  // every helper context, honoring explicit empty resets within that context.
  const config = await readActionCommand(
    process,
    ['config', '--null', '--list'],
    signal,
  );
  const contexts = new Map<string, string[]>();
  for (const record of config.split('\0')) {
    const separator = record.indexOf('\n');
    const key = record.slice(0, separator).toLowerCase();
    if (!/^credential(\..*)?\.helper$/.test(key)) continue;
    const value = record.slice(separator + 1);
    contexts.set(key, value ? [...(contexts.get(key) ?? []), value] : []);
  }
  if (
    [...contexts.values()]
      .flat()
      .some((helper) => !['cache', 'store'].includes(helper))
  )
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
}
