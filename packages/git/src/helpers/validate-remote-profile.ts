import { isAbsolute } from 'node:path';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

export function validateRemoteProfile(url: string): string {
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
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      cause,
      detail:
        'The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with `git remote set-url`, or run this action from a terminal.',
    });
  }
}
