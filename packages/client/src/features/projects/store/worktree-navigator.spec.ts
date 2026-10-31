import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { emptyNavigatorFilter } from '../rules/worktree-navigator.ts';
import { worktreeNavigatorState } from './worktree-navigator.ts';

it('retains search, combined filters and independent project expansion across navigator unmounts', () => {
  const scheduled = new Set<() => void>();
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      scheduled.add(task);
      return () => scheduled.delete(task);
    },
  });
  const state = {
    query: 'Dispatch Desk',
    filter: {
      projects: ['computer/project'],
      environments: ['computer'],
      reviews: ['with-review'],
      older: true,
    },
    expanded: { 'computer/project': true, 'other/project': false },
  };
  try {
    const unmount = registry.mount(worktreeNavigatorState);
    registry.set(worktreeNavigatorState, state);
    unmount();
    for (const task of scheduled) {
      scheduled.delete(task);
      task();
    }
    const remount = registry.mount(worktreeNavigatorState);
    expect(registry.get(worktreeNavigatorState)).toEqual(state);
    remount();
  } finally {
    registry.dispose();
  }
});

it('starts an independent client session with all projects and review choices and older reviews hidden', () => {
  const first = AtomRegistry.make();
  const next = AtomRegistry.make();
  try {
    first.set(worktreeNavigatorState, {
      query: 'old search',
      filter: { projects: [], environments: [], reviews: [], older: true },
      expanded: { old: false },
    });
    expect(next.get(worktreeNavigatorState)).toEqual({
      query: '',
      filter: emptyNavigatorFilter,
      expanded: {},
    });
  } finally {
    first.dispose();
    next.dispose();
  }
});
