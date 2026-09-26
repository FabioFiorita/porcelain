export const DISCARDED_REF_PREFIX = 'refs/porcelain/discarded/';

export type RecoveryBlob = {
  id: string;
  path: string;
  kind: 'hunk' | 'rename';
  cached: string;
  unstaged: string;
  zero: boolean;
};

export function discardedRef(id: string): string {
  return `${DISCARDED_REF_PREFIX}${id}`;
}

export function writeRecoveryBlob(blob: RecoveryBlob): string {
  return JSON.stringify({
    porcelainDiscard: 1,
    id: blob.id,
    path: blob.path,
    kind: blob.kind,
    cached: blob.cached,
    unstaged: blob.unstaged,
    ...(blob.zero ? { zero: true } : {}),
  });
}

export function parseRecoveryBlob(text: string): RecoveryBlob | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('porcelainDiscard' in parsed) ||
    parsed.porcelainDiscard !== 1 ||
    !('id' in parsed) ||
    typeof parsed.id !== 'string' ||
    !('path' in parsed) ||
    typeof parsed.path !== 'string' ||
    !('cached' in parsed) ||
    typeof parsed.cached !== 'string' ||
    !('unstaged' in parsed) ||
    typeof parsed.unstaged !== 'string'
  )
    return undefined;
  return {
    id: parsed.id,
    path: parsed.path,
    kind: 'kind' in parsed && parsed.kind === 'rename' ? 'rename' : 'hunk',
    cached: parsed.cached,
    unstaged: parsed.unstaged,
    zero: 'zero' in parsed && parsed.zero === true,
  };
}
