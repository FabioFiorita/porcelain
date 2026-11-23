import { Effect } from 'effect';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type { CheckWorktreeInput } from '../models/check-worktree.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { checkedWorktree } from '../rules/checked-worktree.ts';

export const lookupCheckedWorktree = Effect.fn(
  'Projects.lookupCheckedWorktree',
)(function* (
  input: CheckWorktreeInput,
  catalog: WorktreeCatalogStore,
  inventory: InventoryStore,
  readClock?: Effect.Effect<{ now: string; staleAfterMs: number }>,
) {
  const entry = catalog.find({ worktreeId: input.worktreeId });
  const observations = catalog.listObservations();
  const project =
    entry && input.requireAvailableProject
      ? yield* inventory.find({ projectId: entry.worktree.projectId })
      : undefined;
  const clock = readClock === undefined ? undefined : yield* readClock;
  const answer = checkedWorktree(input, entry, observations, project, clock);
  if (answer.kind === 'missing') return yield* new WorktreeNotFoundError();
  if (answer.kind === 'unavailable')
    return yield* new WorktreeUnavailableError();
  return answer;
});
