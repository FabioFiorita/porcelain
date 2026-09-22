import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

export function validateHttpsCredentialHelpers(config: string): void {
  // --get-urlmatch returns only the final value, but helpers are a chain. Inspect
  // every helper context, honoring explicit empty resets within that context.
  const contexts = new Map<string, string[]>();
  for (const record of config.split('\0')) {
    const separator = record.indexOf('\n');
    const key = record.slice(0, separator);
    if (!/^credential(\..*)?\.helper$/i.test(key)) continue;
    const value = record.slice(separator + 1);
    contexts.set(key, value ? [...(contexts.get(key) ?? []), value] : []);
  }
  for (const [key, helpers] of contexts)
    if (helpers.some((helper) => !['cache', 'store'].includes(helper)))
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `Git config sets \`${displayKey(key)}\` to a helper other than \`cache\` or \`store\`. Over HTTPS, Porcelain only uses those two, because other helpers can stop to ask for a password. Use an SSH remote, or run this action from a terminal.`,
      });
}

/**
 * The key without anything secret. A helper's value can hold a token, and a
 * `credential.<url>` context can name a user or password, so the message only
 * keeps the URL's origin and path.
 */
function displayKey(key: string): string {
  const context = key.slice('credential.'.length, -'.helper'.length);
  if (!context) return 'credential.helper';
  try {
    const url = new URL(context);
    return `credential.${url.origin === 'null' ? url.protocol : url.origin}${url.pathname === '/' ? '' : url.pathname}.helper`;
  } catch {
    return 'credential.<url>.helper';
  }
}
