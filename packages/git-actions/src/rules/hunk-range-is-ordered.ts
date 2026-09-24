import type { GitActionIntent } from '../models/git-action-intent.ts';

export function hunkRangeIsOrdered(intent: GitActionIntent): boolean {
  if (intent.action !== 'discard' || intent.hunk === undefined) return true;
  return intent.hunk.endLine >= intent.hunk.startLine;
}
