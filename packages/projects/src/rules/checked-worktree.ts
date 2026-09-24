import { instantAfter } from '@porcelain/kernel/rules';
import type {
  CheckWorktreeInput,
  WorktreeCheckAnswer,
} from '../models/check-worktree.ts';
import type { RegisteredProject } from '../models/project.ts';
import type {
  CatalogEntry,
  CatalogObservation,
} from '../models/worktree-catalog.ts';
import { worktreeIsWritable } from './worktree-is-writable.ts';

export function observationStale(
  observation: Pick<CatalogObservation, 'observedAt'>,
  now: string,
  staleAfterMs: number,
): boolean {
  return instantAfter(observation.observedAt, staleAfterMs) < now;
}

export function checkedWorktree(
  input: CheckWorktreeInput,
  entry: CatalogEntry | undefined,
  observations: readonly CatalogObservation[],
  project: RegisteredProject | undefined,
  clock: { now: string; staleAfterMs: number },
): WorktreeCheckAnswer {
  const stale = (observation: CatalogObservation) =>
    observationStale(observation, clock.now, clock.staleAfterMs);
  if (!entry) {
    if (observations.length === 0 || observations.some(stale))
      return { kind: 'stale' };
    return observations.some((observation) => !observation.listed)
      ? { kind: 'unavailable' }
      : { kind: 'missing' };
  }
  if (
    input.projectId !== undefined &&
    entry.worktree.projectId !== input.projectId
  )
    return { kind: 'missing' };
  if (stale(entry.observation)) return { kind: 'stale' };
  if (!entry.observation.listed) return { kind: 'unavailable' };
  if (
    input.purpose === 'writing' &&
    !worktreeIsWritable(entry.worktree, project)
  )
    return { kind: 'unavailable' };
  return { kind: 'found', worktree: entry.worktree };
}
