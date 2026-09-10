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
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', { cause });
  }
}
