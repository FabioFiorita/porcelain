import type { GitDiscardedChange } from '../dtos/git-status.ts';
import { parseRecoveryBlob } from '../../shared/recovery-blob.ts';

export function parseDiscarded(
  content: string,
): Omit<GitDiscardedChange, 'oid'> | undefined {
  const blob = parseRecoveryBlob(content);
  if (blob) return { path: blob.path, kind: blob.kind };
  const path = pathFromDiff(content);
  return path === undefined ? undefined : { path, kind: 'hunk' };
}

function pathFromDiff(diff: string): string | undefined {
  const path = /^diff --git a\/(.+) b\/(.+)$/mu.exec(diff)?.[2];
  if (
    !path ||
    path.includes(' ') ||
    path.startsWith('/') ||
    path.includes('..')
  )
    return undefined;
  return path;
}
