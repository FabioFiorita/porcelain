import type { MoveProblem } from '../models/move-problem.ts';

export function moveProblem(
  path: string,
  destination: string,
): MoveProblem | undefined {
  return destination === path || destination.startsWith(`${path}/`)
    ? { kind: 'into-itself' }
    : undefined;
}
