import type { ChangeComparison, TrackedComparison } from '../models/change.ts';

export function isTracked(
  comparison: ChangeComparison,
): comparison is TrackedComparison {
  return comparison.scope === 'staged' || comparison.scope === 'unstaged';
}
