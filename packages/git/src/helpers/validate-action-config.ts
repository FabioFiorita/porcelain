import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

export function validateActionConfig(config: string): void {
  for (const record of config.split('\0').filter(Boolean)) {
    const separator = record.indexOf('\n');
    const key = record.slice(0, separator).toLowerCase();
    const value = record.slice(separator + 1);
    if (
      /^(filter\..*\.(clean|smudge|process)|core\.sshcommand|remote\..*\.(vcs|uploadpack|receivepack)|core\.sparsecheckout|extensions\.partialclone)$/.test(
        key,
      ) ||
      (/^remote\..*\.mirror$/.test(key) && value !== 'false')
    )
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION');
  }
}
