import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

const TERMINAL = 'Run this action from a terminal instead.';

/** Why each unsupported setting blocks an action, keyed by the lowercased name Git lists. */
function unsupportedSetting(key: string, value: string): string | undefined {
  const name = key.toLowerCase();
  if (/^filter\..*\.(clean|smudge|process)$/.test(name))
    return `Git config sets \`${key}\`. Porcelain does not run conversion filters, so it cannot check the content it would commit or restore. ${TERMINAL}`;
  if (/^remote\..*\.(vcs|uploadpack|receivepack)$/.test(name))
    return `Git config sets \`${key}\`, which replaces the program Git runs for this remote. Remove it with \`git config --unset ${key}\`, or run this action from a terminal.`;
  if (/^remote\..*\.mirror$/.test(name) && value !== 'false')
    return `Git config sets \`${key}\`, so a push would mirror every ref. Porcelain pushes one branch at a time. ${TERMINAL}`;
  if (name === 'core.sparsecheckout')
    return `Git config sets \`core.sparseCheckout\`. Porcelain cannot check the files a sparse checkout leaves out. ${TERMINAL}`;
  if (name === 'extensions.partialclone')
    return `Git config sets \`extensions.partialClone\`. Porcelain does not fetch the objects a partial clone leaves out. ${TERMINAL}`;
  return undefined;
}

export function validateActionConfig(config: string): void {
  for (const record of config.split('\0').filter(Boolean)) {
    const separator = record.indexOf('\n');
    const detail = unsupportedSetting(
      record.slice(0, separator),
      record.slice(separator + 1),
    );
    if (detail)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', { detail });
  }
}
