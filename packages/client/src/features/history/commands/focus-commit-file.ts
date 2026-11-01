import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { historyPlace } from '../queries/history.ts';

export const focusCommitFile = Atom.family((selection: WorktreeSelection) =>
  Atom.fnSync((input: { oid: string; parent: number; path: string }, get) => {
    const place = historyPlace({
      ...selection,
      kind: 'commit',
      oid: input.oid,
      parent: input.parent,
    });
    const current = get(place);
    get.set(place, {
      ...current,
      selected: input.path,
      scrollOffset: 0,
      resetId: current.resetId + 1,
    });
  }),
);
