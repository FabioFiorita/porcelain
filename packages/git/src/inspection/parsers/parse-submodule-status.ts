import { isOid } from '../../shared/oid.ts';

export function parseSubmoduleStatus(
  output: string,
  paths: readonly string[],
): Map<string, string> {
  const heads = new Map<string, string>();
  for (const line of output.split('\n')) {
    const match = /^([ +\-U]?)([0-9a-f]+) (.*)$/u.exec(line);
    const [, state, oid = '', rest = ''] = match ?? [];
    if (state === undefined || state === '-' || !isOid(oid)) continue;
    const path = paths.find(
      (candidate) => rest === candidate || rest.startsWith(`${candidate} (`),
    );
    if (path !== undefined) heads.set(path, oid);
  }
  return heads;
}
