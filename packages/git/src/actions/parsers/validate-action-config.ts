import { parseConfigList } from '../../shared/conversion-filters.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

const TERMINAL = 'Run this action from a terminal instead.';

export function validateActionConfig(config: string): void {
  for (const { key, value } of parseConfigList(config)) {
    const detail = unsupportedSetting(key, value);
    if (detail)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', { detail });
  }
}

function unsupportedSetting(key: string, value: string): string | undefined {
  const name = key.toLowerCase();
  if (/^remote\..*\.(vcs|uploadpack|receivepack)$/u.test(name))
    return `Git config sets \`${key}\`, which replaces the program Git runs for this remote. Remove it with \`git config --unset ${key}\`, or run this action from a terminal.`;
  if (/^remote\..*\.mirror$/u.test(name) && value !== 'false')
    return `Git config sets \`${key}\`, so a push would mirror every ref. Porcelain pushes one branch at a time. ${TERMINAL}`;
  if (name === 'core.sparsecheckout')
    return `Git config sets \`core.sparseCheckout\`. Porcelain cannot check the files a sparse checkout leaves out. ${TERMINAL}`;
  if (name === 'extensions.partialclone')
    return `Git config sets \`extensions.partialClone\`. Porcelain does not fetch the objects a partial clone leaves out. ${TERMINAL}`;
  return undefined;
}
