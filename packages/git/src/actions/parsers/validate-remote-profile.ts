import { isAbsolute } from 'node:path';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

const SCP_LIKE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:[^\s]+$/u;

export function validateRemoteProfile(url: string): string {
  if (isAbsolute(url)) return 'local repository';
  if (SCP_LIKE.test(url)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (cause) {
    throw unsupportedRemote({ cause });
  }
  if (
    !['https:', 'ssh:'].includes(parsed.protocol) ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.protocol === 'https:' && parsed.username)
  )
    throw unsupportedRemote();
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

function unsupportedRemote(options?: ErrorOptions): GitActionRejectedError {
  return new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
    ...options,
    detail:
      'The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with `git remote set-url`, or run this action from a terminal.',
  });
}
