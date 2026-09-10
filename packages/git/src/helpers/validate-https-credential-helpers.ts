import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

export function validateHttpsCredentialHelpers(config: string): void {
  // --get-urlmatch returns only the final value, but helpers are a chain. Inspect
  // every helper context, honoring explicit empty resets within that context.
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
