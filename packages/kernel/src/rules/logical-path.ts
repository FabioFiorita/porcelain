import type { ChangeComparison, ComparisonSides } from '../models/change.ts';
import { isTracked } from './is-tracked.ts';

export function trackedPath(sides: ComparisonSides): string | undefined {
  return sides.newPath ?? sides.oldPath;
}

export function logicalPath(comparison: ChangeComparison): string {
  return isTracked(comparison)
    ? (trackedPath(comparison) ?? '')
    : comparison.path;
}
